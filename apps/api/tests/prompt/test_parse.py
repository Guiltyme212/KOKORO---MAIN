from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from kokoro_api.prompt.parse import parse_llm_output

VALID = json.dumps(
    {
        "style": "Russian spoken-word guided meditation, intimate female voice, no singing",
        "lyrics": "[Intro: ambient, no singing]\n[Spoken word, slow]\nЗайка, [Breath] добро пожаловать.",
        "estimatedDurationSec": 12,
    }
)


def test_parses_valid_json() -> None:
    result = parse_llm_output(VALID)
    assert "Зайка" in result.lyrics
    assert "spoken-word" in result.style
    assert result.estimated_duration_sec == 12


def test_strips_json_fences() -> None:
    result = parse_llm_output("```json\n" + VALID + "\n```")
    assert result.estimated_duration_sec == 12


def test_extracts_json_from_surrounding_prose() -> None:
    raw = f"Here is the JSON:\n{VALID}\nDone."
    result = parse_llm_output(raw)
    assert "Зайка" in result.lyrics


def test_ignores_extra_top_level_fields() -> None:
    raw = json.dumps(
        {
            "style": "spoken-word, no singing",
            "lyrics": "Body of meditation.",
            "estimatedDurationSec": 90,
            "beats": [{"any": "shape"}],
            "notes": "ignored",
        }
    )
    result = parse_llm_output(raw)
    assert result.lyrics == "Body of meditation."
    assert result.estimated_duration_sec == 90


def test_rejects_malformed_json() -> None:
    with pytest.raises(ValueError, match="parse"):
        parse_llm_output("not json")


def test_defaults_estimated_duration_when_missing() -> None:
    raw = json.dumps(
        {
            "style": "spoken-word, no singing",
            "lyrics": "Body.",
        }
    )
    result = parse_llm_output(raw)
    assert result.lyrics == "Body."
    assert result.estimated_duration_sec == 0


def test_rejects_missing_lyrics() -> None:
    bad = json.dumps({"style": "spoken-word, no singing", "estimatedDurationSec": 60})
    with pytest.raises(ValidationError):
        parse_llm_output(bad)


def test_rejects_missing_style() -> None:
    bad = json.dumps({"lyrics": "Body.", "estimatedDurationSec": 60})
    with pytest.raises(ValidationError):
        parse_llm_output(bad)


def test_coerces_legacy_script_field_to_lyrics() -> None:
    # Older writer prompt used `script`; the parser keeps backward-compat
    # shape coercion so a stale prompt doesn't immediately break.
    raw = json.dumps(
        {
            "style": "spoken-word, no singing",
            "script": "Body of meditation.",
            "estimatedDurationSec": 60,
        }
    )
    result = parse_llm_output(raw)
    assert result.lyrics == "Body of meditation."
