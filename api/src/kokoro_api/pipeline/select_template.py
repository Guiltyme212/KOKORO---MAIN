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

    return max(candidates, key=score)
