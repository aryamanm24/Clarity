"""
Deepgram WebSocket proxy for live speech-to-text.

The browser sends audio to our backend; we proxy it to Deepgram and stream
transcripts back. API key stays server-side.
"""

import os
import asyncio
from deepgram import AsyncDeepgramClient
from deepgram.extensions.types.sockets import ListenV1ResultsEvent

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")


class DeepgramProxy:
    """Proxies audio from browser → Deepgram and returns transcripts."""

    def __init__(self):
        self.client = AsyncDeepgramClient(api_key=DEEPGRAM_API_KEY)
        self._connection = None
        self._connect_cm = None
        self._receive_task = None

    async def start(self, on_transcript):
        """
        Start a Deepgram live transcription session.
        on_transcript: async callback(text, is_final)
        """
        self._connect_cm = self.client.listen.v1.connect(
            model="nova-2",
            language="en",
            smart_format="true",
            interim_results="true",
            utterance_end_ms="3000",
            vad_events="true",
            encoding="linear16",
            sample_rate="16000",
            channels="1",
        )
        self._connection = await self._connect_cm.__aenter__()

        async def listen_loop():
            try:
                while True:
                    msg = await self._connection.recv()
                    if isinstance(msg, ListenV1ResultsEvent):
                        transcript = ""
                        if msg.channel and msg.channel.alternatives:
                            transcript = msg.channel.alternatives[0].transcript or ""
                        is_final = msg.is_final or msg.speech_final or False
                        if transcript.strip():
                            await on_transcript(transcript, is_final)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                if "ConnectionClosed" not in str(type(e).__name__):
                    print(f"[Deepgram] Listen error: {e}")

        self._receive_task = asyncio.create_task(listen_loop())
        return True

    async def send_audio(self, audio_bytes: bytes):
        """Send audio chunk to Deepgram."""
        if self._connection:
            await self._connection.send_media(audio_bytes)

    async def stop(self):
        """Close the Deepgram connection."""
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None
        if self._connect_cm and self._connection:
            try:
                await self._connect_cm.__aexit__(None, None, None)
            except Exception:
                pass
        self._connection = None
        self._connect_cm = None
