from __future__ import annotations

import re
from dataclasses import dataclass

from kokoro_api.types import ContentType, Mode, Template


@dataclass(slots=True)
class SelectInput:
    content_type: ContentType
    mode: Mode
    theme_text: str
    becoming: str | None = None


def select_template(templates: list[Template], input: SelectInput) -> Template:
    """Pick the single best-matching template (callers that need exactly one —
    music style, reference audio — use this)."""
    return select_templates(templates, input, top_n=1)[0]


def select_templates(
    templates: list[Template], input: SelectInput, *, top_n: int = 2
) -> list[Template]:
    """Return up to top_n best-matching templates, sorted by score descending.
    The first element is the primary template (drives music style and reference
    audio). The full list with their transcripts feeds the LLM as source
    material for personalization."""
    candidates = [
        template
        for template in templates
        if template.content_type == input.content_type and input.mode in template.modes
    ]
    if not candidates:
        raise ValueError(f"no template for content_type={input.content_type} mode={input.mode}")

    theme_words = {word for word in re.split(r"\W+", input.theme_text.lower()) if word}

    def score(template: Template) -> int:
        keyword_hits = sum(
            1 for keyword in template.theme_keywords if keyword.lower() in theme_words
        )
        becoming_hit = 1 if input.becoming and input.becoming in template.becoming_match else 0
        return keyword_hits * 10 + becoming_hit

    candidates.sort(key=score, reverse=True)
    return candidates[: max(1, top_n)]
