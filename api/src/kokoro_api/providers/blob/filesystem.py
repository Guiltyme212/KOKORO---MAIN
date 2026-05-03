from __future__ import annotations

import time
from pathlib import Path

from kokoro_api.providers.blob.base import BlobStore, PutResult


class FilesystemBlobStore(BlobStore):
    name = "filesystem"

    def __init__(self, *, root_dir: str, public_base_url: str) -> None:
        self._root = Path(root_dir)
        self._base = public_base_url.rstrip("/")

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        _ = content_type
        t0 = time.monotonic()
        path = self._root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(body, str):
            path.write_text(body, encoding="utf-8")
        else:
            path.write_bytes(body)
        return PutResult(
            url=f"{self._base}/{key}",
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        _ = expiry_sec
        return f"{self._base}/{key}"
