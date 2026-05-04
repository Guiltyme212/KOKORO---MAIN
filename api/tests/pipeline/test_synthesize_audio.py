from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.synthesize_audio import SynthesizeAudioInput, synthesize_audio
from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.types import Locale


class FakeAudio(MeditationAudioProvider):
    name = "fake"

    def __init__(self) -> None:
        self.synthesize = AsyncMock(  # type: ignore[method-assign]
            return_value=AudioResult(
                audio_bytes=b"audio",
                mime_type="audio/mpeg",
                duration_sec=60,
                job_ids=["j1"],
                candidate_count=1,
                chosen_candidate=0,
                latency_ms=1000,
            )
        )

    async def synthesize(  # pragma: no cover
        self,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Locale,
        candidates: int,
    ) -> AudioResult:
        raise NotImplementedError


@pytest.mark.asyncio
async def test_passes_writer_style_and_lyrics_verbatim_to_provider() -> None:
    fake = FakeAudio()
    result = await synthesize_audio(
        SynthesizeAudioInput(
            lyrics="[Intro: ambient, no singing]\n[Spoken word, slow]\nHi.",
            style="Russian spoken-word guided meditation, no singing, no chorus",
            target_duration_sec=60,
            reference_track_urls=["https://x/r.mp3"],
            locale="en",
        ),
        fake,
    )
    assert result.audio_bytes == b"audio"
    fake.synthesize.assert_awaited_once()
    kwargs = fake.synthesize.await_args.kwargs
    # No persona system any more — the reference clip drives the voice.
    assert kwargs["voice_persona_id"] == ""
    assert kwargs["music_style_prompt"] == (
        "Russian spoken-word guided meditation, no singing, no chorus"
    )
    assert kwargs["script"].startswith("[Intro: ambient, no singing]")
    assert kwargs["reference_track_urls"] == ["https://x/r.mp3"]
    assert kwargs["target_duration_sec"] == 60
    assert kwargs["candidates"] == 2
