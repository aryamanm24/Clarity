"""
Gemini Live API wrapper for CLARITY voice mode.

Bidirectional audio: PCM 16-bit 16kHz input, PCM 16-bit 24kHz output.
Model: gemini-2.5-flash-native-audio-preview (native audio).
"""

import asyncio
import os
from google import genai
from google.genai import types

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Native audio model for Live API (PCM in/out)
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

# Fallback if primary model not available (older preview)
MODEL_FALLBACK = "gemini-2.5-flash-native-audio-preview-09-2025"


class GeminiLiveSession:
    """Manages a bidirectional audio session with Gemini Live API."""

    def __init__(self, system_instruction: str | None = None):
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.session = None
        self.is_connected = False
        self._connect_context = None

        self.system_instruction = system_instruction or (
            "You are CLARITY, a reasoning analysis assistant. "
            "When the user speaks, briefly acknowledge what you heard in 1-2 sentences. "
            "Paraphrase their key points to show understanding. Then say: "
            "'Let me analyze that for you.' "
            "Keep your response under 10 seconds. Do NOT analyze the logic yourself. "
            "Do NOT wait for analysis results. Just acknowledge and stop."
        )

    async def connect(self):
        """Connect to Gemini Live API. Audio only — no transcription (causes 1008 policy violation and broken syllable-split text)."""
        # IMPORTANT: Only one response modality per session (AUDIO or TEXT, not both).
        # Setting both causes 1007 "invalid frame payload data".
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(
                parts=[types.Part(text=self.system_instruction)]
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Kore"
                    )
                )
            ),
            # DO NOT include input_audio_transcription or output_audio_transcription
            # They cause 1008 policy violations and produce broken syllable-split text
        )

        for model in [MODEL, MODEL_FALLBACK]:
            try:
                self._connect_context = self.client.aio.live.connect(
                    model=model,
                    config=config,
                )
                self.session = await self._connect_context.__aenter__()
                self.is_connected = True
                print(f"Gemini Live connected (model: {model})")
                return self.session
            except Exception as e:
                print(f"Gemini Live connect failed for {model}: {e}")
                if self._connect_context:
                    try:
                        await self._connect_context.__aexit__(Exception, e, None)
                    except Exception:
                        pass
                    self._connect_context = None
        raise RuntimeError("Could not connect to Gemini Live with any model")

    async def send_audio(self, audio_data: bytes):
        """Send raw PCM audio chunk to Gemini Live (16-bit, 16kHz, mono)."""
        if self.session and self.is_connected:
            await self.session.send_realtime_input(
                audio=types.Blob(
                    data=audio_data,
                    mime_type="audio/pcm;rate=16000",
                )
            )

    async def send_text(self, text: str):
        """Send text message to Gemini Live (for injecting analysis context)."""
        if self.session and self.is_connected:
            await self.session.send_client_content(
                turns=types.Content(
                    role="user",
                    parts=[types.Part(text=text)],
                ),
                turn_complete=True,
            )

    async def inject_context(self, text: str):
        """Inject text into the Live session via send_client_content.
        Use this for Phase 2 analysis summary injection (avoids 1008 policy violation).
        """
        if not self.session or not self.is_connected:
            print("⚠️ Cannot inject context — session not connected")
            return
        try:
            await self.session.send_client_content(
                turns=types.Content(
                    role="user",
                    parts=[types.Part(text=text)],
                ),
                turn_complete=True,
            )
            print(f"✅ Injected context ({len(text)} chars)")
        except Exception as e:
            print(f"❌ Context injection failed: {e}")
            raise

    async def receive_responses(self):
        """
        Async generator that yields audio chunks and text from Gemini Live.
        Yields tuples of (type, data):
          - ("audio", bytes)       — PCM audio chunk to play
          - ("text", str)          — Text from model
          - ("turn_complete", None) — Model finished speaking
          - ("interrupted", None)   — User interrupted
        """
        while self.is_connected and self.session:
            try:
                async for response in self.session.receive():
                    if not response.server_content:
                        continue
                    sc = response.server_content
                    if sc.interrupted:
                        yield ("interrupted", None)
                        continue
                    if response.data:
                        yield ("audio", response.data)
                    if response.text:
                        yield ("text", response.text)
                    if sc.turn_complete:
                        yield ("turn_complete", None)
                        break  # End this turn, continue loop for next
            except Exception as e:
                print(f"Gemini Live receive error: {e}")
                break

    async def close(self):
        """Close the Gemini Live session."""
        self.is_connected = False
        if self._connect_context:
            try:
                await self._connect_context.__aexit__(None, None, None)
            except Exception:
                pass
            self._connect_context = None
        self.session = None
