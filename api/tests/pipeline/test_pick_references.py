from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.pipeline.pick_references import (
    PickReferencesInput,
    pick_references,
)
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator


def _ref(id: str) -> ReferenceMeditation:
    return ReferenceMeditation(id=id, title=id, preview="x", full_text="text")


# Library order matters: the picker presents short ids 1..N by enumeration.
# Here: 1=ref-anxiety, 2=ref-money, 3=ref-confidence.
def _library() -> list[ReferenceMeditation]:
    return [_ref("ref-anxiety"), _ref("ref-money"), _ref("ref-confidence")]


def _input() -> PickReferencesInput:
    return PickReferencesInput(
        capture_text="страшно за деньги",
        call_me="Зай",
        mode="soft",
        content_type="unwind",
        becoming="calm",
        locale="ru",
    )


class _FakeLlm(ScriptGenerator):
    name = "picker-fake"
    model = "haiku-fake"

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


def _ok(raw: str) -> LlmResult:
    return LlmResult(
        raw_json=raw, tokens_in=50, tokens_out=10, cache_read_tokens=40, latency_ms=200
    )


@pytest.mark.asyncio
async def test_returns_picked_references_in_order_via_int_ids() -> None:
    raw = json.dumps({"picked": [2, 1]})
    llm = _FakeLlm(_ok(raw))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money", "ref-anxiety"]
    assert result.meta.tokens_in == 50


@pytest.mark.asyncio
async def test_accepts_numeric_strings() -> None:
    raw = json.dumps({"picked": ["2", "1"]})
    llm = _FakeLlm(_ok(raw))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money", "ref-anxiety"]


@pytest.mark.asyncio
async def test_accepts_exact_filename_match_as_fallback() -> None:
    raw = json.dumps({"picked": ["ref-money"]})
    llm = _FakeLlm(_ok(raw))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money"]


@pytest.mark.asyncio
async def test_accepts_references_field_alias_with_dict_items() -> None:
    # Opus's improv: {"references": [{"id": 2, "reason": "..."}]}
    raw = json.dumps(
        {
            "references": [
                {"id": 2, "reason": "money fit"},
                {"id": 1, "reason": "anxiety fit"},
            ]
        }
    )
    llm = _FakeLlm(_ok(raw))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money", "ref-anxiety"]


@pytest.mark.asyncio
async def test_dedupes_repeated_ids() -> None:
    raw = json.dumps({"picked": [2, 2, 1]})
    llm = _FakeLlm(_ok(raw))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money", "ref-anxiety"]


@pytest.mark.asyncio
async def test_retries_on_out_of_range_int_id() -> None:
    bad = json.dumps({"picked": [99]})
    good = json.dumps({"picked": [1]})
    llm = _FakeLlm(_ok(bad), _ok(good))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-anxiety"]
    assert llm.generate.await_count == 2
    second_prompt = llm.generate.await_args_list[1].kwargs["user_prompt"]
    assert "previous response was invalid" in second_prompt


@pytest.mark.asyncio
async def test_retries_on_invented_string_id() -> None:
    bad = json.dumps({"picked": ["fear_pitch_money"]})
    good = json.dumps({"picked": [2]})
    llm = _FakeLlm(_ok(bad), _ok(good))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money"]


@pytest.mark.asyncio
async def test_retries_on_empty_picked_array() -> None:
    bad = json.dumps({"picked": []})
    good = json.dumps({"picked": [2]})
    llm = _FakeLlm(_ok(bad), _ok(good))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money"]


@pytest.mark.asyncio
async def test_retries_on_too_many_picks() -> None:
    bad = json.dumps({"picked": [1, 2, 3, 1]})
    good = json.dumps({"picked": [2]})
    llm = _FakeLlm(_ok(bad), _ok(good))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-money"]


@pytest.mark.asyncio
async def test_strips_markdown_fences_around_json() -> None:
    raw = "```json\n" + json.dumps({"picked": [1]}) + "\n```"
    llm = _FakeLlm(_ok(raw))
    result = await pick_references(_input(), llm, _library())
    assert [r.id for r in result.picked] == ["ref-anxiety"]


@pytest.mark.asyncio
async def test_raises_after_two_invalid_attempts() -> None:
    bad = json.dumps({"picked": [99]})
    llm = _FakeLlm(_ok(bad), _ok(bad))
    with pytest.raises(RuntimeError, match="picker failed"):
        await pick_references(_input(), llm, _library())
