from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.resolve_capture import resolve_capture
from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult
from kokoro_api.types import CaptureText, CaptureTheme, CaptureVoice, Locale


class FakeStt(TranscriptionProvider):
    name = "fake"

    def __init__(self) -> None:
        self.transcribe = AsyncMock(
            return_value=TranscriptionResult(
                text="I am wired",
                confidence=0.91,
                latency_ms=120,
            )
        )

    async def transcribe(
        self,
        *,
        audio_url: str,
        mime_type: str,
        locale: Locale,
    ) -> TranscriptionResult:
        raise NotImplementedError


@pytest.mark.asyncio
async def test_text_passes_through() -> None:
    stt = FakeStt()
    out = await resolve_capture(CaptureText(kind="text", text="long day"), "en", stt)
    assert out.text == "long day"
    assert out.transcription_meta is None
    stt.transcribe.assert_not_awaited()


@pytest.mark.asyncio
async def test_theme_joins_chips() -> None:
    out = await resolve_capture(
        CaptureTheme(kind="theme", chips=["anxious", "tired"]),
        "en",
        FakeStt(),
    )
    assert "anxious" in out.text.lower()
    assert "tired" in out.text.lower()


@pytest.mark.asyncio
async def test_voice_calls_stt() -> None:
    stt = FakeStt()
    out = await resolve_capture(
        CaptureVoice(
            kind="voice",
            audio_url="https://x/a.webm",  # type: ignore[arg-type]
            mime_type="audio/webm",
        ),
        "en",
        stt,
    )
    assert out.text == "I am wired"
    assert out.transcription_meta is not None
    assert out.transcription_meta.provider == "fake"
    assert out.transcription_meta.latency_ms == 120
