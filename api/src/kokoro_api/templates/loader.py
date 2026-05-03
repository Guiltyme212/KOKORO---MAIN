from __future__ import annotations

from pathlib import Path

from kokoro_api.types import Template


def _default_root_dir() -> Path:
    # When invoked from api/ during local dev, templates live one level up.
    return Path.cwd().parent / "templates"


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
