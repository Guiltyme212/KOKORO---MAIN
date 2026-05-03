from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from kokoro_api.prompt.parse import parse_llm_output

VALID = json.dumps(
    {
        "script": "Hi, зай. [breath] Settle.",
        "estimatedDurationSec": 12,
    }
)


def test_parses_valid_json() -> None:
    result = parse_llm_output(VALID)
    assert result.script == "Hi, зай. [breath] Settle."
    assert result.estimated_duration_sec == 12


def test_strips_json_fences() -> None:
    result = parse_llm_output("```json\n" + VALID + "\n```")
    assert result.estimated_duration_sec == 12


def test_extracts_json_from_surrounding_prose() -> None:
    raw = f"Here is the JSON:\n{VALID}\nDone."
    result = parse_llm_output(raw)
    assert result.script == "Hi, зай. [breath] Settle."


def test_ignores_extra_top_level_fields() -> None:
    # LLM sometimes emits beats, hints, etc. — we keep parsing forgiving.
    raw = json.dumps(
        {
            "script": "Body of meditation.",
            "estimatedDurationSec": 90,
            "beats": [{"any": "shape"}],
            "notes": "ignored",
        }
    )
    result = parse_llm_output(raw)
    assert result.script == "Body of meditation."
    assert result.estimated_duration_sec == 90


def test_rejects_malformed_json() -> None:
    with pytest.raises(ValueError, match="parse"):
        parse_llm_output("not json")


def test_defaults_estimated_duration_when_missing() -> None:
    # LLM frequently forgets this field; we don't use it downstream so default to 0
    # rather than burning a retry on a missing duration.
    raw = json.dumps({"script": "Body."})
    result = parse_llm_output(raw)
    assert result.script == "Body."
    assert result.estimated_duration_sec == 0


def test_rejects_missing_script() -> None:
    bad = json.dumps({"estimatedDurationSec": 60})
    with pytest.raises(ValidationError):
        parse_llm_output(bad)
