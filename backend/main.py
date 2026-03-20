import os
import sys
import json
import base64
import asyncio
import io
import time
import uuid
import shutil
from pathlib import Path

# Add vendored dependencies to sys.path
deps_path = str(Path(__file__).parent / "deps")
if deps_path not in sys.path:
    sys.path.insert(0, deps_path)

import av

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from PIL import Image

# vision-agents imports (now from deps)
from vision_agents.plugins import deepgram, gemini
from vision_agents.core.edge.types import Participant
from vision_agents.core.stt import STTTranscriptEvent, STTPartialTranscriptEvent
from vision_agents.core.llm.events import LLMResponseChunkEvent
from getstream.video.rtc import PcmData, AudioFormat

load_dotenv()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ [Backend] Startup complete")
    yield
    print("🔚 [Backend] Shutdown complete")

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global constants and storage
SYSTEM_PROMPT_PREFIX = "You are a helpful voice assistant. RESPOND IN PLAIN TEXT ONLY. No markdown, no asterisks, no bullets. Keep sentences short and conversational. "
vlm_sessions: dict[str, gemini.VLM] = {}

# Helper for standard REST streaming (non-live)
async def stream_gemini_response(prompt, video_path=None, session_id=None, system_prompt=None):
    active_system_prompt = system_prompt or SYSTEM_PROMPT_PREFIX
    with open("debug.log", "a") as f:
        f.write(f"\n--- New Request: {time.ctime()} ---\n")
        f.write(f"Prompt: {prompt}\n")
        f.write(f"Video Path: {video_path}\n")
        f.write(f"Session ID: {session_id}\n")
        f.write(f"System Prompt: {active_system_prompt[:80]}...\n")

    vlm = None
    if session_id and session_id in vlm_sessions:
        vlm = vlm_sessions[session_id]
        print(f"🔄 [Backend] Reusing VLM session: {session_id}")
    else:
        vlm = gemini.VLM(model="gemini-3-flash-preview", frame_buffer_seconds=300)
        if session_id:
            vlm_sessions[session_id] = vlm
            print(f"🆕 [Backend] Created new VLM session: {session_id}")

    if video_path:
        # Clear existing frames if a new video is uploaded to an existing session
        if hasattr(vlm, "_frame_buffer"):
            vlm._frame_buffer.clear()
            print(f"🧹 [Backend] Cleared frame buffer for session {session_id}")

        print(f"🎞️ [Backend] Extracting frames from: {video_path}")
        try:
            container = av.open(video_path)
            stream = container.streams.video[0]
            
            # Get video info
            duration = float(stream.duration * stream.time_base) if stream.duration else 0
            total_frames = stream.frames if stream.frames else 0
            info = f"🎥 [Backend] Video Info: duration={duration}s, total_frames={total_frames}"
            print(info)
            with open("debug.log", "a") as f: f.write(info + "\n")

            fps = 1
            interval = 1.0 / fps
            next_timestamp = 0.0
            
            frame_count = 0
            decoded_count = 0
            for frame in container.decode(video=0):
                decoded_count += 1
                if frame.pts is not None:
                    timestamp = float(frame.pts * stream.time_base)
                else:
                    stream_fps = float(stream.average_rate) if stream.average_rate else 30
                    timestamp = decoded_count / stream_fps

                if timestamp >= next_timestamp:
                    vlm.add_frame(frame)
                    next_timestamp += interval
                    frame_count += 1
                    if frame_count % 10 == 0:
                        msg = f"  ...extracted {frame_count} frames (at {timestamp:.2f}s)"
                        print(msg)
                        with open("debug.log", "a") as f: f.write(msg + "\n")
                    if frame_count >= 100: # Max 100 frames
                        break
            
            container.close()
            final_msg = f"✅ [Backend] Successfully extracted {frame_count} frames from {decoded_count} decoded"
            print(final_msg)
            buffer_msg = f"📦 [Backend] VLM buffer size: {len(vlm._frame_buffer)}"
            print(buffer_msg)
            with open("debug.log", "a") as f: 
                f.write(final_msg + "\n")
                f.write(buffer_msg + "\n")
        except Exception as e:
            err_msg = f"❌ [Backend] Error during frame extraction: {e}"
            print(err_msg)
            with open("debug.log", "a") as f: f.write(err_msg + "\n")
            import traceback
            traceback.print_exc()

    try:
        event_queue = asyncio.Queue()
        async def on_chunk(event: LLMResponseChunkEvent):
            if event.delta: await event_queue.put(event.delta)
        
        vlm.events.subscribe(on_chunk)
        task = asyncio.create_task(vlm.simple_response(active_system_prompt + "\n\n" + prompt))
        
        while not task.done() or not event_queue.empty():
            try:
                chunk = await asyncio.wait_for(event_queue.get(), timeout=0.1)
                yield chunk.replace("**", "").replace("*", "")
            except asyncio.TimeoutError:
                if task.done(): break
        
        vlm.events.unsubscribe(on_chunk)
        await task
    except Exception as e:
        yield f"Error: {str(e)}"

@app.websocket("/live_chat")
async def live_chat_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("🚀 [Live Chat] Session started")
    
    # PER-SESSION VLM, STT, and TTS FOR ISOLATION
    vlm = gemini.VLM(model="gemini-flash-latest")
    stt = deepgram.STT(eager_turn_detection=True)
    tts = deepgram.TTS()
    
    transcript_queue = asyncio.Queue()
    tts_text_queue = asyncio.Queue()
    default_participant = Participant(id="user", user_id="user", original=None)
    
    # Task references for session management
    session_tasks = []
    active_tasks = [] # Tracks LLM inference and TTS streaming per turn
    ai_active = False # Flag to know if AI is currently responding
    ws_connected = True  # Guard flag to prevent sends on closed socket

    async def safe_send(msg: dict):
        """Send JSON to WebSocket only if still connected."""
        if not ws_connected:
            return
        try:
            await websocket.send_json(msg)
        except Exception:
            pass  # Connection already closed

    def reset_turn():
        nonlocal active_tasks, ai_active
        # 1. Clear the TTS text queue
        while not tts_text_queue.empty():
            try: tts_text_queue.get_nowait()
            except: pass
        
        # 2. Cancel all active tasks related to the current turn
        if active_tasks:
            print(f"🛑 [Barge-in] Interrupting active AI turn ({len(active_tasks)} tasks)")
            for t in active_tasks:
                if not t.done(): t.cancel()
            active_tasks = []
        
        # 3. Notify frontend to silence immediate playback
        if ws_connected:
            try:
                asyncio.create_task(safe_send({"type": "clear_audio"}))
            except Exception:
                pass
        ai_active = False

    @stt.events.subscribe
    async def on_stt_transcript(event: STTTranscriptEvent):
        if not ws_connected:
            return
        if event.text:
            print(f"🎤 [STT Final]: {event.text}")
            reset_turn()
            await safe_send({"type": "transcript", "content": event.text})
            await transcript_queue.put(event.text)

    @stt.events.subscribe
    async def on_stt_partial(event: STTPartialTranscriptEvent):
        nonlocal ai_active
        if not ws_connected:
            return
        if event.text and ai_active:
            # INSTANT BARGE-IN: Stop AI as soon as user starts speaking
            print(f"🤫 [Barge-in] User speaking: {event.text[:20]}...")
            reset_turn()
            await safe_send({"type": "partial_transcript", "content": event.text})

    async def stream_to_tts(text):
        if not text.strip(): return
        clean_text = text.replace("**", "").replace("*", "").replace("#", "").replace("- ", "")
        print(f"🔊 [TTS] {clean_text[:40]}...")
        try:
            async for pcm_chunk in await tts.stream_audio(clean_text):
                if pcm_chunk and len(pcm_chunk.samples) > 0:
                    b64_audio = base64.b64encode(pcm_chunk.to_bytes()).decode("utf-8")
                    await safe_send({"type": "audio", "content": b64_audio})
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"❌ [TTS Error]: {e}")

    async def tts_worker():
        while True:
            try:
                text = await tts_text_queue.get()
                if text is None: break
                
                tts_stream_task = asyncio.create_task(stream_to_tts(text))
                active_tasks.append(tts_stream_task)
                try:
                    await tts_stream_task
                except asyncio.CancelledError:
                    print("🔊 [TTS] Current sentence cancelled")
                finally:
                    if tts_stream_task in active_tasks:
                        active_tasks.remove(tts_stream_task)
                
                tts_text_queue.task_done()
            except asyncio.CancelledError:
                # The whole worker was stopped (session ended)
                break
            except Exception as e:
                print(f"❌ [TTS Worker Error]: {e}")

    async def llm_orchestrator():
        nonlocal ai_active
        while True:
            try:
                transcript = await transcript_queue.get()
                ai_active = True
                print(f"🤖 [Orchestrator] Processing: {transcript}")
                
                if not transcript or len(transcript.strip()) < 1:
                    transcript_queue.task_done()
                    ai_active = False
                    continue

                chunk_queue = asyncio.Queue()
                async def on_llm_chunk(event: LLMResponseChunkEvent):
                    if event.delta: await chunk_queue.put(event.delta)

                vlm.events.subscribe(on_llm_chunk)
                
                async def run_vlm():
                    try:
                        full_prompt = SYSTEM_PROMPT_PREFIX + transcript
                        await vlm.simple_response(full_prompt)
                    except asyncio.CancelledError:
                        raise
                    except Exception as e:
                        print(f"❌ [VLM Error]: {e}")
                    finally:
                        await chunk_queue.put(None)

                inference_task = asyncio.create_task(run_vlm())
                active_tasks.append(inference_task)
                
                current_sentence = ""
                try:
                    while True:
                        delta = await chunk_queue.get()
                        if delta is None: break
                        
                        clean_delta = delta.replace("**", "").replace("*", "")
                        await safe_send({"type": "text", "content": clean_delta})
                        current_sentence += clean_delta
                        
                        if any(c in clean_delta for c in ".!?\n") and len(current_sentence) > 20:
                            await tts_text_queue.put(current_sentence)
                            current_sentence = ""
                    
                    if current_sentence:
                        await tts_text_queue.put(current_sentence)
                except asyncio.CancelledError:
                    print("🤖 [Orchestrator] Inference cancelled")
                finally:
                    vlm.events.unsubscribe(on_llm_chunk)
                    if inference_task in active_tasks:
                        active_tasks.remove(inference_task)
                    if not inference_task.done(): 
                        inference_task.cancel()
                    
                    # Ensure turn is marked as complete even if cancelled
                    await safe_send({"type": "text_end"})
                
                transcript_queue.task_done()
                ai_active = False
                
            except asyncio.CancelledError:
                ai_active = False
                break
            except Exception as e:
                print(f"❌ [Orchestrator Error]: {e}")
                ai_active = False

    # Session level tasks
    orchestrator_task = asyncio.create_task(llm_orchestrator())
    tts_worker_task = asyncio.create_task(tts_worker())
    session_tasks = [orchestrator_task, tts_worker_task, vlm]

    try:
        await stt.start()
        print("🎙️ [STT] Started")
        while ws_connected:
            try:
                data = await websocket.receive()
                if not ws_connected: break
                
                if "bytes" in data:
                    pcm = PcmData.from_bytes(data["bytes"], sample_rate=16000, format=AudioFormat.S16, channels=1)
                    await stt.process_audio(pcm, participant=default_participant)
                elif "text" in data:
                    msg = json.loads(data["text"])
                    if msg.get("type") == "prompt":
                        reset_turn()
                        await transcript_queue.put(msg.get("content"))
                    elif msg.get("type") == "image":
                        try:
                            # Decode base64 data URL (format: data:image/jpeg;base64,...)
                            data_url = msg.get("content", "")
                            if "," in data_url:
                                img_data = base64.b64decode(data_url.split(",", 1)[1])
                            else:
                                img_data = base64.b64decode(data_url)
                            pil_img = Image.open(io.BytesIO(img_data)).convert("RGB")
                            frame = av.VideoFrame.from_image(pil_img)
                            vlm._frame_buffer.append(frame)
                            print(f"🖼️ [Live Chat] Added screen frame ({pil_img.size[0]}x{pil_img.size[1]}), buffer: {len(vlm._frame_buffer)}")
                        except Exception as img_err:
                            print(f"❌ [Live Chat] Error processing image: {img_err}")
            except (WebSocketDisconnect, RuntimeError):
                break
    
    except WebSocketDisconnect:
        print("🔌 [Live Chat] Disconnected")
    except Exception as e:
        print(f"❌ [Live Chat Main Error]: {e}")
    finally:
        ws_connected = False  # Mark closed FIRST to stop all sends
        reset_turn()
        # Unsubscribe STT handlers
        try:
            stt.events.unsubscribe(on_stt_transcript)
        except Exception:
            pass
        try:
            stt.events.unsubscribe(on_stt_partial)
        except Exception:
            pass
        for t in session_tasks: 
            if hasattr(t, 'cancel'): t.cancel()
        print("🔚 [Live Chat] Session closed")

@app.post("/analyze_stream")
async def analyze_video_stream(
    video: UploadFile = File(None),
    prompt: str = Form("Describe this video"),
    session_id: str = Form(None),
    system_prompt: str = Form(None)
):
    call_msg = f"🚀 [Backend] /analyze_stream called with video={video.filename if video else 'None'}, prompt='{prompt}', session_id={session_id}"
    print(call_msg)
    with open("debug.log", "a") as f: f.write(call_msg + "\n")
    
    video_path = None
    if video:
        try:
            # Create a temporary file to save the uploaded video
            temp_dir = Path("temp_videos")
            temp_dir.mkdir(exist_ok=True)
            suffix = Path(video.filename).suffix
            temp_file = temp_dir / f"{uuid.uuid4()}{suffix}"
            video_path = str(temp_file)
            
            save_msg = f"💾 [Backend] Saving uploaded video to {video_path}"
            print(save_msg)
            with open(video_path, "wb") as buffer:
                shutil.copyfileobj(video.file, buffer)
            size_msg = f"✅ [Backend] Video saved successfully ({os.path.getsize(video_path)} bytes)"
            print(size_msg)
            with open("debug.log", "a") as f: 
                f.write(save_msg + "\n")
                f.write(size_msg + "\n")
        except Exception as e:
            err_msg = f"❌ [Backend] Error saving video: {e}"
            print(err_msg)
            with open("debug.log", "a") as f: f.write(err_msg + "\n")
            video_path = None
        
    async def wrapped_stream():
        try:
            async for chunk in stream_gemini_response(prompt, video_path, session_id, system_prompt):
                yield chunk
        finally:
            # Cleanup
            if video_path and os.path.exists(video_path):
                try:
                    os.remove(video_path)
                    print(f"🧹 [Backend] Cleaned up temp video: {video_path}")
                except:
                    pass

    return StreamingResponse(wrapped_stream(), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
