from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

PREVIEW_CHARS = 400


@dataclass(slots=True, frozen=True)
class ReferenceMeditation:
    id: str
    title: str
    preview: str
    full_text: str


def _default_root_dir() -> Path:
    # __file__ -> api/src/kokoro_api/library/loader.py
    # parents[3] -> api/
    return Path(__file__).resolve().parents[3] / "meditation_scripts"


def load_library(*, root_dir: str | Path | None = None) -> list[ReferenceMeditation]:
    root = Path(root_dir) if root_dir is not None else _default_root_dir()
    if not root.exists():
        raise RuntimeError(f"meditation library not found at {root}")

    out: list[ReferenceMeditation] = []
    for path in sorted(root.iterdir()):
        if path.suffix.lower() != ".txt":
            continue
        full_text = path.read_text(encoding="utf-8").strip()
        if not full_text:
            continue
        meditation_id = path.stem
        out.append(
            ReferenceMeditation(
                id=meditation_id,
                title=meditation_id,
                preview=full_text[:PREVIEW_CHARS],
                full_text=full_text,
            )
        )

    if not out:
        raise RuntimeError(f"meditation library at {root} has no .txt files")
    return out
