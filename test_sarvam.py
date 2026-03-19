import asyncio
import json
import websockets

async def test_sarvam():
    url = "wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v2"
    headers = {"Api-Subscription-Key": "dummy_key_to_force_401"}
    
    try:
        async with websockets.connect(url, additional_headers=headers) as ws:
            print("Connected!")
            
            payload = {
                "type": "config",
                "data": {
                    "target_language_code": "en-IN",
                    "speaker": "anushka",
                    "pitch": 0.0,
                    "pace": 1.0,
                    "speech_sample_rate": 22050,
                    "enable_preprocessing": False,
                    "output_audio_codec": "mp3",
                    "output_audio_bitrate": "128k",
                    "min_buffer_size": 10,
                    "max_chunk_length": 150,
                    "model": "bulbul:v2"
                }
            }
            print("--- Testing Payload with model inside data ---")
            await ws.send(json.dumps(payload))
            
            async for msg in ws:
                print(f"Received from server: {msg[:200]}")
                break
            
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"WebSocket Connect Error: Status Code {e.status_code}")
        print("A 401 means the payload structure was NEVER checked because the key was invalid immediately.")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_sarvam())
