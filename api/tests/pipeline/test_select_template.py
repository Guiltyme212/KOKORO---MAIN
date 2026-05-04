from __future__ import annotations

import pytest

from kokoro_api.pipeline.select_template import select_template
from kokoro_api.types import Template


def _tpl(vibe: str, id_: str | None = None) -> Template:
    return Template(
        id=id_ or f"vibe_{vibe}_01",
        vibe=vibe,  # type: ignore[arg-type]
        target_duration_sec=300,
        music_style_prompt="ambient pad, no melody",
        reference_track_urls=[f"{vibe}.mp3"],
        transcript="dummy transcript content",
        writer_directive="dummy directive",
    )


def test_returns_template_for_matching_vibe() -> None:
    templates = [_tpl("raw"), _tpl("zen"), _tpl("sleep")]
    assert select_template(templates, "zen").id == "vibe_zen_01"


def test_first_match_wins_when_multiple() -> None:
    templates = [_tpl("zen", "vibe_zen_01"), _tpl("zen", "vibe_zen_02")]
    assert select_template(templates, "zen").id == "vibe_zen_01"


def test_raises_when_no_match() -> None:
    templates = [_tpl("zen")]
    with pytest.raises(ValueError, match="no template for vibe"):
        select_template(templates, "raw")
