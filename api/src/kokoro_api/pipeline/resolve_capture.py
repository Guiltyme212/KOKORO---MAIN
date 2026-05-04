from __future__ import annotations

from pydantic import BaseModel

from kokoro_api.providers.stt.base import TranscriptionProvider
from kokoro_api.types import (
    Capture,
    CaptureText,
    CaptureTheme,
    CaptureVoice,
    Locale,
    TranscriptionMeta,
)


class ResolvedCapture(BaseModel):
    text: str
    transcription_meta: TranscriptionMeta | None = None


async def resolve_capture(
    capture: Capture,
    locale: Locale,
    stt: TranscriptionProvider,
) -> ResolvedCapture:
    if isinstance(capture, CaptureText):
        return ResolvedCapture(text=capture.text)

    if isinstance(capture, CaptureTheme):
        return ResolvedCapture(text=f"Carrying {', '.join(capture.chips)}.")

    if isinstance(capture, CaptureVoice):
        # Frontend may have already transcribed via Web Speech; trust it
        # unless the field is missing/empty.
        if capture.transcribed_text and capture.transcribed_text.strip():
            return ResolvedCapture(
                text=capture.transcribed_text.strip(),
                transcription_meta=TranscriptionMeta(
                    provider="frontend-web-speech",
                    latency_ms=0,
                    confidence=1.0,
                ),
            )
        result = await stt.transcribe(
            audio_url=str(capture.audio_url),
            mime_type=capture.mime_type,
            locale=locale,
        )
        return ResolvedCapture(
            text=result.text,
            transcription_meta=TranscriptionMeta(
                provider=stt.name,
                latency_ms=result.latency_ms,
                confidence=result.confidence,
            ),
        )

    raise TypeError(f"unsupported capture kind: {type(capture)!r}")
