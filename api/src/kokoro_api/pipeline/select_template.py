from __future__ import annotations

from dataclasses import dataclass

from kokoro_api.types import ContentType, Mode, Template


@dataclass(slots=True)
class SelectInput:
    content_type: ContentType
    mode: Mode


def select_template(templates: list[Template], input: SelectInput) -> Template:
    """Pick the template that drives music + duration + reference audio for this
    (content_type, mode). Reference transcripts are now picked separately by the
    LLM picker from meditation_scripts/, so this is a flat lookup — no keyword
    scoring, no top-N."""
    for template in templates:
        if template.content_type == input.content_type and input.mode in template.modes:
            return template
    raise ValueError(
        f"no template for content_type={input.content_type} mode={input.mode}"
    )
