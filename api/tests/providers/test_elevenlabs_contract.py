from __future__ import annotations

import os

import pytest

from kokoro_api.providers.stt.elevenlabs import ElevenLabsTranscriptionProvider


@pytest.mark.integration
@pytest.mark.asyncio
async def test_elevenlabs_transcribes_short_clip() -> None:
    provider = ElevenLabsTranscriptionProvider(
        api_key=os.environ["ELEVENLABS_API_KEY"],
        base_url=os.environ.get("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io"),
        model=os.environ.get("ELEVENLABS_MODEL", "scribe_v2"),
    )
    result = await provider.transcribe(
        audio_url="https://github.com/voxpupuli/audio-fixtures/raw/main/hello-en.mp3",
        mime_type="audio/mpeg",
        locale="en",
    )
    assert "hello" in result.text.lower()
    assert result.latency_ms > 0
