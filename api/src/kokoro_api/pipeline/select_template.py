from __future__ import annotations

from kokoro_api.types import Template, Vibe


def select_template(templates: list[Template], vibe: Vibe) -> Template:
    """Return the template registered for the given vibe.

    There is exactly one template per vibe; if multiple exist, the first
    in load order wins. Raises ValueError when nothing matches — that
    means the operator forgot to commit a template for this vibe.
    """
    for template in templates:
        if template.vibe == vibe:
            return template
    available = ", ".join(sorted({t.vibe for t in templates})) or "<none>"
    raise ValueError(f"no template for vibe={vibe!r}; available: {available}")
