from __future__ import annotations

from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult
from kokoro_api.types import Locale


class DisabledTranscriptionProvider(TranscriptionProvider):
    name = "disabled-stt"

    async def transcribe(
        self,
        *,
        audio_url: str,
        mime_type: str,
        locale: Locale,
    ) -> TranscriptionResult:
        _ = (audio_url, mime_type, locale)
        raise RuntimeError("voice capture requires ELEVENLABS_API_KEY or WHISPER_API_KEY")
