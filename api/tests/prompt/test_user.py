from __future__ import annotations

import re

from kokoro_api.prompt.user import BuildUserArgs, build_user_prompt
from kokoro_api.types import Template


def _tpl() -> Template:
    return Template(
        id="vibe_zen_01",
        vibe="zen",
        target_duration_sec=420,
        music_style_prompt="zen ambient with bell tones",
        reference_track_urls=["zen.mp3"],
        transcript="Sit. Breathe. Watch it pass.",
        writer_directive="Voice: Zen-spare. One small idea per breath.",
    )


def test_includes_call_me_capture_and_template_fields() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="зай",
            capture_text="столько мыслей",
            template=_tpl(),
            history=None,
        )
    )
    assert "зай" in prompt
    assert "столько мыслей" in prompt
    assert "zen" in prompt
    assert "420" in prompt
    assert "Voice: Zen-spare" in prompt
    assert "Sit. Breathe. Watch it pass." in prompt


def test_includes_history_block_when_present() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="brother",
            capture_text="...",
            template=_tpl(),
            history={
                "previous_scripts": ["Yesterday you set an intention..."],
                "last_vibe": "iron",
            },
        )
    )
    assert re.search(r"<history>", prompt)
    assert "Yesterday" in prompt
    assert "last_vibe: iron" in prompt


def test_omits_history_block_when_empty() -> None:
    prompt = build_user_prompt(
        BuildUserArgs(
            call_me="x",
            capture_text="y",
            template=_tpl(),
            history=None,
        )
    )
    assert "<history>" not in prompt
