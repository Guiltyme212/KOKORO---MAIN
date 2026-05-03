from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.generate_script import GenerateScriptInput, generate_script
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator
from kokoro_api.types import RegisterNotes, Template, TemplateBeat


def _tpl() -> Template:
    return Template(
        id="unwind_a",
        content_type="unwind",
        modes=["soft"],
        becoming_match=["calm"],
        theme_keywords=[],
        target_duration_sec=60,
        music_style_prompt="ambient pad",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="open", sec=30, intent="x"),
            TemplateBeat(id="mid", sec=15, intent="y"),
            TemplateBeat(id="close", sec=15, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


VALID_JSON = json.dumps(
    {
        "script": "Hi, зай. [breath]",
        "estimatedDurationSec": 60,
    }
)


class FakeLlm(ScriptGenerator):
    name = "fake"
    model = "fake-1"

    def __init__(self) -> None:
        self.generate = AsyncMock(
            return_value=LlmResult(
                raw_json=VALID_JSON,
                tokens_in=100,
                tokens_out=200,
                cache_read_tokens=80,
                latency_ms=500,
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


@pytest.mark.asyncio
async def test_produces_parsed_script_and_meta() -> None:
    result = await generate_script(
        GenerateScriptInput(
            call_me="зай",
            mode="soft",
            capture_text="tired",
            becoming="calm",
            templates=[_tpl()],
            history=None,
            locale="en",
        ),
        FakeLlm(),
    )
    assert "зай" in result.script
    assert result.estimated_duration_sec == 60
    assert result.meta.tokens_out == 200
    assert result.meta.cache_read_tokens == 80


@pytest.mark.asyncio
async def test_retries_once_on_parse_failure() -> None:
    class FlakyLlm(ScriptGenerator):
        name = "flaky"
        model = "flaky-1"

        def __init__(self) -> None:
            self.generate = AsyncMock(
                side_effect=[
                    LlmResult(
                        raw_json="not json",
                        tokens_in=1,
                        tokens_out=1,
                        cache_read_tokens=0,
                        latency_ms=1,
                    ),
                    LlmResult(
                        raw_json=VALID_JSON,
                        tokens_in=100,
                        tokens_out=200,
                        cache_read_tokens=0,
                        latency_ms=500,
                    ),
                ]
            )

        async def generate(
            self,
            *,
            system_prompt: str,
            user_prompt: str,
            cache_key: str,
        ) -> LlmResult:
            raise NotImplementedError

    flaky = FlakyLlm()
    result = await generate_script(
        GenerateScriptInput(
            call_me="x",
            mode="soft",
            capture_text="y",
            becoming="calm",
            templates=[_tpl()],
            history=None,
            locale="en",
        ),
        flaky,
    )
    assert "зай" in result.script
    assert flaky.generate.await_count == 2
    second_prompt = flaky.generate.await_args_list[1].kwargs["user_prompt"]
    assert "previous response was invalid" in second_prompt
