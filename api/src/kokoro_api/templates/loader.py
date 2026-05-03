from __future__ import annotations

from pathlib import Path

from kokoro_api.types import Template


def _default_root_dir() -> Path:
    # Templates ship inside api/ alongside the service. Resolve via __file__
    # so the path is the same in dev (cwd=api/) and in Railway containers
    # (cwd=/app, code at /app/src/kokoro_api/...).
    # __file__ -> api/src/kokoro_api/templates/loader.py
    # parents[3] -> api/
    return Path(__file__).resolve().parents[3] / "templates"


async def load_templates(*, root_dir: str | Path | None = None) -> list[Template]:
    root = Path(root_dir) if root_dir is not None else _default_root_dir()
    out: list[Template] = []

    for sub in ("unwind", "attract", "lockin"):
        directory = root / sub
        for path in sorted(directory.iterdir()):
            if path.suffix != ".json":
                continue
            out.append(Template.model_validate_json(path.read_text(encoding="utf-8")))

    return out
