from __future__ import annotations

import os

import pytest

from kokoro_api.providers.stt.whisper import WhisperProvider


@pytest.mark.integration
@pytest.mark.asyncio
async def test_whisper_transcribes_short_clip() -> None:
    provider = WhisperProvider(
        api_key=os.environ["WHISPER_API_KEY"],
        base_url=os.environ.get("WHISPER_BASE_URL", "https://api.openai.com/v1"),
    )
    result = await provider.transcribe(
        audio_url="https://github.com/voxpupuli/audio-fixtures/raw/main/hello-en.mp3",
        mime_type="audio/mpeg",
        locale="en",
    )
    assert "hello" in result.text.lower()
    assert result.latency_ms > 0
