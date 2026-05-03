from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.synthesize_audio import SynthesizeAudioInput, synthesize_audio
from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.types import Locale, RegisterNotes, Template, TemplateBeat


def _tpl() -> Template:
    return Template(
        id="unwind_a",
        content_type="unwind",
        modes=["soft"],
        becoming_match=["calm"],
        theme_keywords=[],
        target_duration_sec=60,
        music_style_prompt="warm ambient",
        reference_track_urls=["https://x/r.mp3"],
        structure=[
            TemplateBeat(id="a", sec=30, intent="x"),
            TemplateBeat(id="b", sec=15, intent="y"),
            TemplateBeat(id="c", sec=15, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


class FakeAudio(MeditationAudioProvider):
    name = "fake"

    def __init__(self) -> None:
        self.synthesize = AsyncMock(
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

    async def synthesize(
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
async def test_passes_voice_preset_style_refs_to_provider() -> None:
    fake = FakeAudio()
    voice_presets = {
        "mira": {"persona_id": "persona-mira", "style_hint": "soft female voice"},
        "brad": {"persona_id": "", "style_hint": "deep voice"},
        "aiko": {"persona_id": "", "style_hint": "gentle voice"},
        "sage": {"persona_id": "", "style_hint": "neutral voice"},
    }

    result = await synthesize_audio(
        SynthesizeAudioInput(
            script="Hi.",
            voice_id="mira",
            template=_tpl(),
            locale="en",
        ),
        fake,
        voice_presets,
    )

    assert result.audio_bytes == b"audio"
    fake.synthesize.assert_awaited_once()
    kwargs = fake.synthesize.await_args.kwargs
    assert kwargs["voice_persona_id"] == "persona-mira"
    assert kwargs["music_style_prompt"] == "soft female voice; warm ambient"
    assert kwargs["reference_track_urls"] == ["https://x/r.mp3"]
    assert kwargs["target_duration_sec"] == 60
    assert kwargs["candidates"] == 2


@pytest.mark.asyncio
async def test_allows_empty_persona_when_preset_exists() -> None:
    fake = FakeAudio()
    await synthesize_audio(
        SynthesizeAudioInput(
            script="x",
            voice_id="mira",
            template=_tpl(),
            locale="en",
        ),
        fake,
        {"mira": {"persona_id": "", "style_hint": "soft female voice"}},
    )
    kwargs = fake.synthesize.await_args.kwargs
    assert kwargs["voice_persona_id"] == ""


@pytest.mark.asyncio
async def test_throws_if_voice_preset_missing() -> None:
    fake = FakeAudio()
    with pytest.raises(RuntimeError, match="voice preset"):
        await synthesize_audio(
            SynthesizeAudioInput(
                script="x",
                voice_id="mira",
                template=_tpl(),
                locale="en",
            ),
            fake,
            {},
        )
