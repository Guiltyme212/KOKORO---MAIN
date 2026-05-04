from __future__ import annotations

import pytest

from kokoro_api.pipeline.select_template import SelectInput, select_template
from kokoro_api.types import Template


def _t(id: str, ct: str, modes: list[str]) -> Template:
    return Template(
        id=id,
        content_type=ct,  # type: ignore[arg-type]
        modes=modes,  # type: ignore[arg-type]
        target_duration_sec=360,
        music_style_prompt="warm ambient pad, spoken-word friendly",
        reference_track_urls=[],
    )


@pytest.fixture
def fixtures() -> list[Template]:
    return [
        _t("unwind_a", "unwind", ["soft", "sharp"]),
        _t("attract_a", "attract", ["soft", "sharp"]),
        _t("lockin_a", "lockin", ["soft", "sharp"]),
    ]


def test_picks_by_content_type(fixtures: list[Template]) -> None:
    template = select_template(
        fixtures,
        SelectInput(content_type="attract", mode="soft"),
    )
    assert template.id == "attract_a"


def test_returns_first_template_matching_mode() -> None:
    templates = [
        _t("unwind_a", "unwind", ["sharp"]),
        _t("unwind_b", "unwind", ["soft", "sharp"]),
    ]
    template = select_template(
        templates,
        SelectInput(content_type="unwind", mode="soft"),
    )
    assert template.id == "unwind_b"


def test_throws_when_no_template_for_content_type(fixtures: list[Template]) -> None:
    with pytest.raises(ValueError, match="no template"):
        select_template(
            [t for t in fixtures if t.content_type != "lockin"],
            SelectInput(content_type="lockin", mode="soft"),
        )


def test_throws_when_no_template_for_mode() -> None:
    templates = [_t("unwind_a", "unwind", ["sharp"])]
    with pytest.raises(ValueError, match="no template"):
        select_template(
            templates,
            SelectInput(content_type="unwind", mode="soft"),
        )
