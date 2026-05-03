from __future__ import annotations

import pytest

from kokoro_api.pipeline.select_template import SelectInput, select_template
from kokoro_api.types import RegisterNotes, Template, TemplateBeat


def _t(id: str, ct: str, becoming: list[str], keywords: list[str]) -> Template:
    return Template(
        id=id,
        content_type=ct,  # type: ignore[arg-type]
        modes=["soft", "sharp"],
        becoming_match=becoming,
        theme_keywords=keywords,
        target_duration_sec=360,
        music_style_prompt="warm ambient pad",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="a", sec=60, intent="x"),
            TemplateBeat(id="b", sec=60, intent="y"),
            TemplateBeat(id="c", sec=60, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


@pytest.fixture
def fixtures() -> list[Template]:
    return [
        _t("unwind_a", "unwind", ["calm", "softness"], ["pressure", "tired"]),
        _t("attract_a", "attract", ["future", "confidence"], ["amsterdam", "morning"]),
    ]


def test_picks_by_content_type_first(fixtures: list[Template]) -> None:
    template = select_template(
        fixtures,
        SelectInput(
            content_type="attract",
            mode="soft",
            theme_text="random",
            becoming="calm",
        ),
    )
    assert template.id == "attract_a"


def test_breaks_ties_by_keyword_overlap(fixtures: list[Template]) -> None:
    more = [*fixtures, _t("unwind_b", "unwind", ["calm"], ["amsterdam"])]
    template = select_template(
        more,
        SelectInput(
            content_type="unwind",
            mode="soft",
            theme_text="pressure tired",
            becoming="calm",
        ),
    )
    assert template.id == "unwind_a"


def test_falls_back_to_becoming_match(fixtures: list[Template]) -> None:
    template = select_template(
        fixtures,
        SelectInput(
            content_type="unwind",
            mode="soft",
            theme_text="gibberish nothing",
            becoming="softness",
        ),
    )
    assert template.id == "unwind_a"


def test_throws_when_no_template_for_content_type(fixtures: list[Template]) -> None:
    with pytest.raises(ValueError, match="no template"):
        select_template(
            fixtures,
            SelectInput(
                content_type="lockin",
                mode="soft",
                theme_text="",
                becoming="calm",
            ),
        )
