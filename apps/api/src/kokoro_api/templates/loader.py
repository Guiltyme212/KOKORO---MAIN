from __future__ import annotations

from pathlib import Path

from kokoro_api.types import Template


def _default_root_dir() -> Path:
    # __file__ -> api/src/kokoro_api/templates/loader.py
    # parents[3] -> api/
    return Path(__file__).resolve().parents[3] / "templates"


async def load_templates(*, root_dir: str | Path | None = None) -> list[Template]:
    """Read every `vibe_*.json` from the templates directory."""
    root = Path(root_dir) if root_dir is not None else _default_root_dir()
    if not root.is_dir():
        raise RuntimeError(f"templates directory not found: {root}")

    out: list[Template] = []
    for path in sorted(root.iterdir()):
        if path.suffix.lower() != ".json":
            continue
        out.append(Template.model_validate_json(path.read_text(encoding="utf-8")))

    if not out:
        raise RuntimeError(f"no vibe templates found in {root}")
    return out
