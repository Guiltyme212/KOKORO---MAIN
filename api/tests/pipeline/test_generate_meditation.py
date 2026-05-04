from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.pipeline.generate_meditation import (
    GenerateMeditationInput,
    generate_meditation,
)
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator


def _ref(id: str = "ref-1") -> ReferenceMeditation:
    return ReferenceMeditation(
        id=id, title=id, preview="x", full_text="A real meditation transcript."
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
        mode="soft",
        capture_text="tired",
        becoming="calm",
        references=[_ref()],
        target_duration_sec=60,
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
    llm = _FakeLlm(
        LlmResult(
            raw_json="not json",
            tokens_in=1,
            tokens_out=1,
            cache_read_tokens=0,
            latency_ms=1,
        ),
        _ok_result(),
    )
    result = await generate_meditation(_input(), llm)
    assert "Зай" in result.lyrics
    assert llm.generate.await_count == 2
    second_prompt = llm.generate.await_args_list[1].kwargs["user_prompt"]
    assert "previous response was invalid" in second_prompt


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
    second_prompt = llm.generate.await_args_list[1].kwargs["user_prompt"]
    assert "MEDITATION" in second_prompt
    assert "song" in second_prompt.lower()


@pytest.mark.asyncio
async def test_ships_with_warnings_when_both_attempts_violate_rules() -> None:
    # Two consecutive bad-but-parseable outputs. We don't fail the user —
    # we ship the second with validation_warnings populated.
    bad_json = json.dumps(
        {
            "style": "pop dance edm",
            "lyrics": "[Verse 1]\nLa la la",
            "estimatedDurationSec": 60,
        }
    )
    llm = _FakeLlm(_ok_result(bad_json), _ok_result(bad_json))
    result = await generate_meditation(_input(), llm)
    assert result.validation_warnings, "expected violations to be populated"
    assert any("forbidden" in w.lower() for w in result.validation_warnings)


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
