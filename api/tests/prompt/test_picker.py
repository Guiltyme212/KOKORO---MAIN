from __future__ import annotations

import re

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.prompt.picker import (
    BuildPickerArgs,
    build_picker_system_prompt,
    build_picker_user_prompt,
)


def _ref(id: str, body: str) -> ReferenceMeditation:
    return ReferenceMeditation(id=id, title=id, preview=body[:200], full_text=body)


def _args() -> BuildPickerArgs:
    return BuildPickerArgs(
        capture_text="long day, pressure",
        call_me="Зай",
        mode="soft",
        content_type="unwind",
        becoming="calm",
        locale="ru",
    )


def test_system_prompt_warns_about_meditation_not_song() -> None:
    prompt = build_picker_system_prompt([_ref("ref-1", "abc")])
    assert "SPOKEN-WORD" in prompt
    assert re.search(r"not a song", prompt, re.I)


def test_system_prompt_stays_short_and_independent_of_library_size() -> None:
    # Catalog now lives in the user prompt (the cli-proxy strips long system
    # prompts). The system prompt must stay short and not include the catalog.
    small = build_picker_system_prompt([_ref("ref-1", "x")])
    big = build_picker_system_prompt(
        [_ref(f"ref-{i}", "y" * 200) for i in range(95)]
    )
    assert small == big
    assert len(small) < 1500
    assert "ref-1" not in small


def test_user_prompt_embeds_catalog_with_short_numeric_ids() -> None:
    library = [_ref("first-ref", "preview text 1"), _ref("second-ref", "preview text 2")]
    prompt = build_picker_user_prompt(_args(), library)
    # Each catalog entry is `<n>. [<title>] <preview>` — the leading number
    # is what the picker LLM returns.
    assert "1. [first-ref]" in prompt
    assert "2. [second-ref]" in prompt
    # And mentions the valid id range so the model can't invent.
    assert f"between 1 and {len(library)}" in prompt


def test_user_prompt_specifies_output_schema() -> None:
    prompt = build_picker_user_prompt(_args(), [_ref("ref-1", "x"), _ref("ref-2", "y")])
    assert '"picked"' in prompt
    assert "INTEGERS" in prompt
    assert "1 to 3" in prompt


def test_user_prompt_collapses_newlines_in_previews() -> None:
    body = "Line one.\nLine two.\nLine three."
    prompt = build_picker_user_prompt(_args(), [_ref("ref-1", body)])
    assert "Line one. Line two. Line three." in prompt
    assert "Line one.\nLine two." not in prompt


def test_user_prompt_carries_per_request_fields() -> None:
    prompt = build_picker_user_prompt(_args(), [_ref("ref-1", "x")])
    assert "Зай" in prompt
    assert "long day, pressure" in prompt
    assert "unwind" in prompt
    assert "calm" in prompt
    assert "ru" in prompt


def test_user_prompt_handles_missing_becoming() -> None:
    args = BuildPickerArgs(
        capture_text="x",
        call_me="y",
        mode="sharp",
        content_type="lockin",
        becoming=None,
        locale="en",
    )
    prompt = build_picker_user_prompt(args, [_ref("ref-1", "x")])
    assert "unspecified" in prompt
