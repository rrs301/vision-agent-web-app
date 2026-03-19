import os
import sys
import json
import base64
import asyncio
import io
import time
from pathlib import Path

# Add vendored dependencies to sys.path
deps_path = str(Path(__file__).parent / "deps")
if deps_path not in sys.path:
    sys.path.insert(0, deps_path)

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

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared but clean plugin instances
class GlobalPlugins:
    def __init__(self):
        self.stt = None
        self.tts = None

gp = GlobalPlugins()

SYSTEM_PROMPT_PREFIX = "You are a helpful voice assistant. RESPOND IN PLAIN TEXT ONLY. No markdown, no asterisks, no bullets. Keep sentences short and conversational. "

@app.on_event("startup")
async def startup():
    gp.stt = deepgram.STT(eager_turn_detection=True)
    gp.tts = deepgram.TTS()
    print("✅ [Backend] Global plugins initialized")

# Helper for standard REST streaming (non-live)
async def stream_gemini_response(prompt):
    vlm = gemini.VLM(model="gemini-flash-latest")
    try:
        event_queue = asyncio.Queue()
        async def on_chunk(event: LLMResponseChunkEvent):
            if event.delta: await event_queue.put(event.delta)
        
        vlm.events.subscribe(on_chunk)
        task = asyncio.create_task(vlm.simple_response(SYSTEM_PROMPT_PREFIX + prompt))
        
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
    
    # PER-SESSION VLM FOR HISTORY
    vlm = gemini.VLM(model="gemini-flash-latest")
    transcript_queue = asyncio.Queue()
    tts_text_queue = asyncio.Queue()
    default_participant = Participant(id="user", user_id="user", original=None)
    
    # Task references for session management
    session_tasks = []
    active_tasks = [] # Tracks LLM inference and TTS streaming per turn
    ai_active = False # Flag to know if AI is currently responding

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
        asyncio.create_task(websocket.send_json({"type": "clear_audio"}))
        ai_active = False

    @gp.stt.events.subscribe
    async def on_stt_transcript(event: STTTranscriptEvent):
        if event.text:
            print(f"🎤 [STT Final]: {event.text}")
            reset_turn()
            await websocket.send_json({"type": "transcript", "content": event.text})
            await transcript_queue.put(event.text)

    @gp.stt.events.subscribe
    async def on_stt_partial(event: STTPartialTranscriptEvent):
        nonlocal ai_active
        if event.text and ai_active:
            # INSTANT BARGE-IN: Stop AI as soon as user starts speaking
            print(f"🤫 [Barge-in] User speaking: {event.text[:20]}...")
            reset_turn()
            await websocket.send_json({"type": "partial_transcript", "content": event.text})

    async def stream_to_tts(text):
        if not text.strip(): return
        clean_text = text.replace("**", "").replace("*", "").replace("#", "").replace("- ", "")
        print(f"🔊 [TTS] {clean_text[:40]}...")
        try:
            async for pcm_chunk in await gp.tts.stream_audio(clean_text):
                if pcm_chunk and len(pcm_chunk.samples) > 0:
                    b64_audio = base64.b64encode(pcm_chunk.to_bytes()).decode("utf-8")
                    await websocket.send_json({"type": "audio", "content": b64_audio})
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
                        await websocket.send_json({"type": "text", "content": clean_delta})
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
                    await websocket.send_json({"type": "text_end"})
                
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
        await gp.stt.start()
        print("🎙️ [STT] Started")
        while True:
            data = await websocket.receive()
            if "bytes" in data:
                pcm = PcmData.from_bytes(data["bytes"], sample_rate=16000, format=AudioFormat.S16, channels=1)
                await gp.stt.process_audio(pcm, participant=default_participant)
            elif "text" in data:
                msg = json.loads(data["text"])
                if msg.get("type") == "prompt":
                    reset_turn()
                    await transcript_queue.put(msg.get("content"))
    
    except WebSocketDisconnect:
        print("🔌 [Live Chat] Disconnected")
    except Exception as e:
        print(f"❌ [Live Chat Main Error]: {e}")
    finally:
        reset_turn()
        for t in session_tasks: 
            if hasattr(t, 'cancel'): t.cancel()
        print("🔚 [Live Chat] Session closed")

@app.post("/analyze_stream")
async def analyze_video_stream(
    video: UploadFile = File(None),
    prompt: str = Form("Describe this video")
):
    return StreamingResponse(stream_gemini_response(prompt), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
