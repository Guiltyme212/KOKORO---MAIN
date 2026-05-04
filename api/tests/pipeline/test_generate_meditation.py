from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.generate_meditation import (
    GenerateMeditationInput,
    generate_meditation,
)
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator
from kokoro_api.types import Template


def _tpl() -> Template:
    return Template(
        id="vibe_zen_01",
        vibe="zen",
        target_duration_sec=60,
        music_style_prompt="zen ambient",
        reference_track_urls=["zen.mp3"],
        transcript="Sit. Breathe. Watch it pass.",
        writer_directive="Voice: Zen-spare. One small idea per breath.",
    )


VALID_LYRICS = (
    "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
    "Зай, [Breath] добро пожаловать. Зай, ты здесь. Зай, отпусти. [Outro: fading]"
)
VALID_STYLE = (
    "Russian spoken-word guided meditation, intimate female voice, no singing, "
    "no melody on vocals, no chorus, no rap, no rhymes, slow breathing pace"
)
VALID_JSON = json.dumps(
    {"style": VALID_STYLE, "lyrics": VALID_LYRICS, "estimatedDurationSec": 60}
)


def _input() -> GenerateMeditationInput:
    return GenerateMeditationInput(
        call_me="Зай",
        capture_text="tired",
        template=_tpl(),
        history=None,
        locale="ru",
    )


class _FakeLlm(ScriptGenerator):
    name = "fake"
    model = "fake-1"

    def __init__(self, *responses: LlmResult) -> None:
        self.generate = AsyncMock(side_effect=list(responses))  # type: ignore[method-assign]

    async def generate(  # pragma: no cover
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        cache_key: str,
    ) -> LlmResult:
        raise NotImplementedError


def _ok_result(raw: str = VALID_JSON) -> LlmResult:
    return LlmResult(
        raw_json=raw,
        tokens_in=100,
        tokens_out=200,
        cache_read_tokens=80,
        latency_ms=500,
    )


@pytest.mark.asyncio
async def test_produces_parsed_meditation_and_meta() -> None:
    llm = _FakeLlm(_ok_result())
    result = await generate_meditation(_input(), llm)
    assert "Зай" in result.lyrics
    assert "spoken-word" in result.style
    assert result.estimated_duration_sec == 60
    assert result.validation_warnings == []
    assert result.meta.tokens_out == 200
    assert result.meta.cache_read_tokens == 80


@pytest.mark.asyncio
async def test_retries_once_on_parse_failure() -> None:
    bad = LlmResult(
        raw_json="not json",
        tokens_in=1,
        tokens_out=1,
        cache_read_tokens=0,
        latency_ms=1,
    )
    llm = _FakeLlm(bad, _ok_result())
    result = await generate_meditation(_input(), llm)
    assert "Зай" in result.lyrics
    assert llm.generate.await_count == 2


@pytest.mark.asyncio
async def test_retries_on_validation_failure_and_passes_violations_back() -> None:
    bad_json = json.dumps(
        {
            "style": "pop dance edm rap",  # missing 'spoken' / 'no singing'
            "lyrics": "[Verse 1]\nLa la la",  # forbidden tag, missing pet name
            "estimatedDurationSec": 60,
        }
    )
    llm = _FakeLlm(_ok_result(bad_json), _ok_result())
    result = await generate_meditation(_input(), llm)
    assert result.validation_warnings == []
    assert llm.generate.await_count == 2


@pytest.mark.asyncio
async def test_raises_when_both_attempts_unparseable() -> None:
    bad = LlmResult(
        raw_json="garbage",
        tokens_in=1,
        tokens_out=1,
        cache_read_tokens=0,
        latency_ms=1,
    )
    llm = _FakeLlm(bad, bad)
    with pytest.raises(RuntimeError, match="meditation generation failed"):
        await generate_meditation(_input(), llm)
