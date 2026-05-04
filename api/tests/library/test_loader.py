from __future__ import annotations

from pathlib import Path

import pytest

from kokoro_api.library.loader import PREVIEW_CHARS, load_library


def test_loads_real_library() -> None:
    refs = load_library()
    assert len(refs) > 0
    # Names look like "1. Wish Fulfillment Meditation - ...". Each id matches the
    # filename minus extension.
    sample = refs[0]
    assert sample.id == sample.title
    assert sample.full_text
    assert sample.preview
    assert len(sample.preview) <= PREVIEW_CHARS


def test_rejects_nonexistent_dir() -> None:
    with pytest.raises(RuntimeError, match="not found"):
        load_library(root_dir="/nonexistent")


def test_rejects_empty_dir(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="no .txt files"):
        load_library(root_dir=tmp_path)


def test_loads_only_txt_files(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("Real meditation text.", encoding="utf-8")
    (tmp_path / "b.md").write_text("Should be ignored.", encoding="utf-8")
    (tmp_path / "c.TXT").write_text("Upper-case extension is fine.", encoding="utf-8")

    refs = load_library(root_dir=tmp_path)
    ids = sorted(r.id for r in refs)
    assert ids == ["a", "c"]


def test_skips_empty_files(tmp_path: Path) -> None:
    (tmp_path / "good.txt").write_text("Real text.", encoding="utf-8")
    (tmp_path / "empty.txt").write_text("   \n\n", encoding="utf-8")

    refs = load_library(root_dir=tmp_path)
    assert [r.id for r in refs] == ["good"]


def test_preview_truncates_long_files(tmp_path: Path) -> None:
    body = "А" * (PREVIEW_CHARS * 3)
    (tmp_path / "long.txt").write_text(body, encoding="utf-8")

    refs = load_library(root_dir=tmp_path)
    assert len(refs[0].preview) == PREVIEW_CHARS
    assert len(refs[0].full_text) == len(body)
