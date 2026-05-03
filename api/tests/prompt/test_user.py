from __future__ import annotations

import re

from kokoro_api.prompt.user import BuildUserArgs, build_user_prompt
from kokoro_api.types import RegisterNotes, Template, TemplateBeat


def _tpl() -> Template:
    return Template(
        id="unwind_a",
        content_type="unwind",
        modes=["soft"],
        becoming_match=["calm"],
        theme_keywords=["tired"],
        target_duration_sec=360,
        music_style_prompt="ambient pad",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="open", sec=30, intent="ground in body"),
            TemplateBeat(id="close", sec=30, intent="rest"),
            TemplateBeat(id="seal", sec=30, intent="anchor"),
        ],
        register_notes=RegisterNotes(soft="warm", sharp="direct"),
    )


def test_embeds_call_me_capture_becoming_template() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="зай",
            mode="soft",
            capture_text="long day, pressure",
            becoming="calm",
            templates=[_tpl()],
            history=None,
        )
    )
    assert "зай" in prompt
    assert "long day, pressure" in prompt
    assert "calm" in prompt
    assert "ground in body" in prompt
    assert "360" in prompt


def test_includes_history_block_when_present() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="brother",
            mode="sharp",
            capture_text="...",
            becoming="focus",
            templates=[_tpl()],
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
            templates=[_tpl()],
            history=None,
        )
    )
    assert "<history>" not in prompt
