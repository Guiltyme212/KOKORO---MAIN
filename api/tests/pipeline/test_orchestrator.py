from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.pipeline.orchestrator import PipelineDeps, run_pipeline
from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.providers.blob.base import BlobStore, PutResult
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator
from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult
from kokoro_api.types import (
    CaptureText,
    GenerateMeditationInput,
    Locale,
    Template,
)


def _tpl() -> Template:
    return Template(
        id="unwind_a",
        content_type="unwind",
        modes=["soft", "sharp"],
        target_duration_sec=60,
        music_style_prompt="ambient pad, spoken-word friendly",
        reference_track_urls=[],
    )


def _ref(id: str = "ref-1") -> ReferenceMeditation:
    return ReferenceMeditation(
        id=id, title=id, preview="x", full_text="A real reference transcript."
    )


PICKER_JSON = json.dumps({"picked": ["ref-1"]})
WRITER_JSON = json.dumps(
    {
        "style": (
            "Russian spoken-word guided meditation, intimate female voice, "
            "no singing, no melody on vocals, no chorus, no rap, no rhymes, "
            "slow breathing pace"
        ),
        "lyrics": (
            "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
            "Зай, [Breath] здесь. Зай, [Pause] отпусти. Зай, рядом. [Outro: fading]"
        ),
        "estimatedDurationSec": 60,
    }
)


class FakeStt(TranscriptionProvider):
    name = "stt-fake"

    def __init__(self) -> None:
        self.transcribe = AsyncMock(  # type: ignore[method-assign]
            return_value=TranscriptionResult(text="unused", confidence=1.0, latency_ms=1)
        )

    async def transcribe(  # pragma: no cover
        self,
        *,
        audio_url: str,
        mime_type: str,
        locale: Locale,
    ) -> TranscriptionResult:
        raise NotImplementedError


class _FakeLlm(ScriptGenerator):
    def __init__(self, name: str, raw: str) -> None:
        self.name = name
        self.model = f"{name}-1"
        self.generate = AsyncMock(  # type: ignore[method-assign]
            return_value=LlmResult(
                raw_json=raw,
                tokens_in=10,
                tokens_out=20,
                cache_read_tokens=0,
                latency_ms=10,
            )
        )

    async def generate(  # pragma: no cover
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
        self.synthesize = AsyncMock(  # type: ignore[method-assign]
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


class FakeBlob(BlobStore):
    name = "blob-fake"

    def __init__(self) -> None:
        self.put = AsyncMock(  # type: ignore[method-assign]
            side_effect=lambda *, key, body, content_type: PutResult(
                url=f"https://cdn/{key}",
                latency_ms=1,
            )
        )
        self.signed_url = AsyncMock(  # type: ignore[method-assign]
            side_effect=lambda key, _expiry: f"https://cdn/{key}?sig=1"
        )

    async def put(  # pragma: no cover
        self, *, key: str, body: bytes | str, content_type: str
    ) -> PutResult:
        raise NotImplementedError

    async def signed_url(self, key: str, expiry_sec: int) -> str:  # pragma: no cover
        raise NotImplementedError

    async def get(self, key: str) -> bytes | None:  # pragma: no cover
        _ = key
        return None


def _make_deps() -> tuple[PipelineDeps, FakeStt, _FakeLlm, _FakeLlm, FakeAudio]:
    stt = FakeStt()
    picker = _FakeLlm("picker", PICKER_JSON)
    writer = _FakeLlm("writer", WRITER_JSON)
    audio = FakeAudio()
    deps = PipelineDeps(
        templates=[_tpl()],
        library=[_ref()],
        stt=stt,
        llm_picker=picker,
        llm_writer=writer,
        audio=audio,
        blob=FakeBlob(),
        voice_presets={
            "mira": {"persona_id": "p-mira", "style_hint": "soft voice"},
            "brad": {"persona_id": "", "style_hint": "deep voice"},
            "aiko": {"persona_id": "", "style_hint": "gentle voice"},
            "sage": {"persona_id": "", "style_hint": "neutral voice"},
        },
    )
    return deps, stt, picker, writer, audio


def _input() -> GenerateMeditationInput:
    return GenerateMeditationInput(
        call_me="Зай",
        mode="soft",
        capture=CaptureText(kind="text", text="tired"),
        content_type="unwind",
        becoming="calm",
        voice_id="mira",
        locale="ru",
        request_id=UUID("11111111-1111-1111-1111-111111111111"),
    )


@pytest.mark.asyncio
async def test_produces_valid_output_with_picked_refs_and_style() -> None:
    deps, _, _, _, _ = _make_deps()
    output = await run_pipeline(_input(), deps)
    assert "Зай" in output.lyrics
    assert "spoken-word" in output.style
    assert output.picked_reference_ids == ["ref-1"]
    assert "audio.mp3" in output.audio_url
    assert output.provider_meta.total_latency_ms >= 0


@pytest.mark.asyncio
async def test_does_not_call_stt_for_text_capture() -> None:
    deps, stt, _, _, _ = _make_deps()
    await run_pipeline(_input(), deps)
    stt.transcribe.assert_not_awaited()


@pytest.mark.asyncio
async def test_passes_writer_style_verbatim_to_audio_provider() -> None:
    deps, _, _, _, audio = _make_deps()
    await run_pipeline(_input(), deps)
    kwargs = audio.synthesize.await_args.kwargs
    # The orchestrator must NOT prepend voice-preset hints; the writer's
    # style is what reaches Suno.
    assert "spoken-word guided meditation" in kwargs["music_style_prompt"]
    assert "no singing" in kwargs["music_style_prompt"]
    assert kwargs["script"].startswith("[Intro: ambient, no singing]")


@pytest.mark.asyncio
async def test_calls_picker_then_writer() -> None:
    deps, _, picker, writer, _ = _make_deps()
    await run_pipeline(_input(), deps)
    picker.generate.assert_awaited_once()
    writer.generate.assert_awaited_once()
