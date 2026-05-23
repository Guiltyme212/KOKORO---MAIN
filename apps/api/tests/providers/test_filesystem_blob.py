from __future__ import annotations

from pathlib import Path

import pytest

from kokoro_api.providers.blob.filesystem import FilesystemBlobStore


@pytest.mark.asyncio
async def test_writes_file_returns_url(tmp_path: Path) -> None:
    store = FilesystemBlobStore(
        root_dir=str(tmp_path), public_base_url="http://localhost:8787/blob"
    )
    result = await store.put(key="x/y/z.mp3", body=b"hello", content_type="audio/mpeg")
    assert result.url == "http://localhost:8787/blob/x/y/z.mp3"
    assert (tmp_path / "x" / "y" / "z.mp3").read_bytes() == b"hello"


@pytest.mark.asyncio
async def test_signed_url_returns_same_path(tmp_path: Path) -> None:
    store = FilesystemBlobStore(root_dir=str(tmp_path), public_base_url="http://h/b")
    url = await store.signed_url("a.mp3", 60)
    assert url == "http://h/b/a.mp3"
