from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from kokoro_api.pipeline.orchestrator import PipelineDeps, run_pipeline
from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.providers.blob.base import BlobStore, PutResult
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator
from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult
from kokoro_api.types import (
    CaptureText,
    GenerateMeditationInput,
    Locale,
    RegisterNotes,
    Template,
    TemplateBeat,
)


def _tpl() -> Template:
    return Template(
        id="unwind_a",
        content_type="unwind",
        modes=["soft", "sharp"],
        becoming_match=["calm"],
        theme_keywords=["tired"],
        target_duration_sec=60,
        music_style_prompt="ambient pad",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="open", sec=20, intent="x"),
            TemplateBeat(id="mid", sec=20, intent="y"),
            TemplateBeat(id="close", sec=20, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


VALID_LLM = json.dumps(
    {
        "script": "Hi зай.",
        "estimatedDurationSec": 60,
    }
)


class FakeStt(TranscriptionProvider):
    name = "stt-fake"

    def __init__(self) -> None:
        self.transcribe = AsyncMock(
            return_value=TranscriptionResult(text="unused", confidence=1.0, latency_ms=1)
        )

    async def transcribe(
        self,
        *,
        audio_url: str,
        mime_type: str,
        locale: Locale,
    ) -> TranscriptionResult:
        raise NotImplementedError


class FakeLlm(ScriptGenerator):
    name = "llm-fake"
    model = "fake-1"

    def __init__(self) -> None:
        self.generate = AsyncMock(
            return_value=LlmResult(
                raw_json=VALID_LLM,
                tokens_in=1,
                tokens_out=1,
                cache_read_tokens=0,
                latency_ms=1,
            )
        )

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        cache_key: str,
    ) -> LlmResult:
        raise NotImplementedError


class FakeAudio(MeditationAudioProvider):
    name = "audio-fake"

    def __init__(self) -> None:
        self.synthesize = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"mp3",
                mime_type="audio/mpeg",
                duration_sec=60,
                job_ids=["j1"],
                candidate_count=2,
                chosen_candidate=0,
                latency_ms=1,
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


class FakeBlob(BlobStore):
    name = "blob-fake"

    def __init__(self) -> None:
        self.put = AsyncMock(
            side_effect=lambda *, key, body, content_type: PutResult(
                url=f"https://cdn/{key}",
                latency_ms=1,
            )
        )
        self.signed_url = AsyncMock(side_effect=lambda key, _expiry: f"https://cdn/{key}?sig=1")

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        raise NotImplementedError

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        raise NotImplementedError


def _make_deps() -> tuple[PipelineDeps, FakeStt]:
    stt = FakeStt()
    deps = PipelineDeps(
        templates=[_tpl()],
        stt=stt,
        llm=FakeLlm(),
        audio=FakeAudio(),
        blob=FakeBlob(),
        voice_presets={
            "mira": {"persona_id": "p-mira", "style_hint": "soft voice"},
            "brad": {"persona_id": "", "style_hint": "deep voice"},
            "aiko": {"persona_id": "", "style_hint": "gentle voice"},
            "sage": {"persona_id": "", "style_hint": "neutral voice"},
        },
    )
    return deps, stt


def _input() -> GenerateMeditationInput:
    return GenerateMeditationInput(
        call_me="зай",
        mode="soft",
        capture=CaptureText(kind="text", text="tired"),
        content_type="unwind",
        becoming="calm",
        voice_id="mira",
        locale="en",
        request_id=UUID("11111111-1111-1111-1111-111111111111"),
    )


@pytest.mark.asyncio
async def test_produces_valid_output() -> None:
    deps, _ = _make_deps()
    output = await run_pipeline(_input(), deps)
    assert "зай" in output.script
    assert "audio.mp3" in output.audio_url
    assert output.template_used_id == "unwind_a"
    assert output.provider_meta.total_latency_ms >= 0


@pytest.mark.asyncio
async def test_does_not_call_stt_for_text_capture() -> None:
    deps, stt = _make_deps()
    await run_pipeline(_input(), deps)
    stt.transcribe.assert_not_awaited()
