"""
ElevenLabs text-to-speech for voice response.

Generates speech from the most important analysis finding and returns base64 MP3.
"""

import os
import base64
from elevenlabs import AsyncElevenLabs

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Default voice: Adam — clear, professional male
DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"


async def generate_speech(text: str, voice_id: str = DEFAULT_VOICE_ID) -> str:
    """
    Generate speech audio from text using ElevenLabs.

    Returns base64-encoded MP3 audio.
    """
    if not ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY not set")

    client = AsyncElevenLabs(api_key=ELEVENLABS_API_KEY)

    try:
        audio_bytes = b""
        async for chunk in client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_turbo_v2_5",
            output_format="mp3_44100_64",
            optimize_streaming_latency=2,
        ):
            audio_bytes += chunk

        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as e:
        print(f"ElevenLabs TTS error: {e}")
        # Sync fallback
        try:
            from elevenlabs import ElevenLabs

            sync_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
            audio_bytes = b""
            for chunk in sync_client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_64",
            ):
                audio_bytes += chunk
            return base64.b64encode(audio_bytes).decode("utf-8")
        except Exception as e2:
            print(f"ElevenLabs sync fallback failed: {e2}")
            raise
