from __future__ import annotations

import re

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.prompt.user import BuildUserArgs, build_user_prompt


def _ref(id: str, text: str) -> ReferenceMeditation:
    return ReferenceMeditation(id=id, title=id, preview=text[:200], full_text=text)


def test_embeds_call_me_capture_becoming_target_duration() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="зай",
            mode="soft",
            capture_text="long day, pressure",
            becoming="calm",
            references=[_ref("ref-1", "Some real meditation text here, full transcript.")],
            target_duration_sec=360,
            history=None,
        )
    )
    assert "зай" in prompt
    assert "long day, pressure" in prompt
    assert "calm" in prompt
    assert "360" in prompt


def test_includes_source_meditations_block_when_refs_present() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="x",
            mode="soft",
            capture_text="y",
            becoming=None,
            references=[
                _ref("ref-1", "First meditation transcript text."),
                _ref("ref-2", "Second meditation transcript text."),
            ],
            target_duration_sec=240,
            history=None,
        )
    )
    assert "<source_meditations>" in prompt
    assert "ref-1" in prompt
    assert "ref-2" in prompt
    assert "First meditation transcript text." in prompt
    assert "Second meditation transcript text." in prompt


def test_omits_source_meditations_when_no_refs() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="x",
            mode="soft",
            capture_text="y",
            becoming=None,
            references=[],
            target_duration_sec=240,
            history=None,
        )
    )
    assert "<source_meditations>" not in prompt


def test_includes_history_block_when_present() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="brother",
            mode="sharp",
            capture_text="...",
            becoming="focus",
            references=[_ref("ref-1", "x")],
            target_duration_sec=120,
            history={
                "previous_scripts": ["Yesterday you set an intention..."],
                "last_becoming": "focus",
            },
        )
    )
    assert re.search(r"<history>", prompt)
    assert "Yesterday" in prompt


def test_omits_history_block_when_empty() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="x",
            mode="soft",
            capture_text="y",
            becoming="calm",
            references=[_ref("ref-1", "x")],
            target_duration_sec=60,
            history=None,
        )
    )
    assert "<history>" not in prompt


def test_reminds_writer_this_is_a_meditation_not_a_song() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="x",
            mode="soft",
            capture_text="y",
            becoming=None,
            references=[],
            target_duration_sec=60,
            history=None,
        )
    )
    assert re.search(r"not a song", prompt, re.I) or "MEDITATION" in prompt
