from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.persist import PersistInput, persist
from kokoro_api.providers.blob.base import BlobStore, PutResult


class FakeBlob(BlobStore):
    name = "fake"

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

        async def put(*, key: str, body: bytes | str, content_type: str) -> PutResult:
            self.calls.append({"key": key, "body": body, "content_type": content_type})
            return PutResult(url=f"https://cdn/{key}", latency_ms=5)

        self.put = AsyncMock(side_effect=put)
        self.signed_url = AsyncMock(side_effect=lambda key, _expiry: f"https://cdn/{key}?sig=x")

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        raise NotImplementedError

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        raise NotImplementedError

    async def get(self, key: str) -> bytes | None:
        _ = key
        return None


@pytest.mark.asyncio
async def test_writes_audio_meta_returns_signed_url() -> None:
    blob = FakeBlob()
    result = await persist(
        PersistInput(
            meditation_id="m1",
            audio_bytes=b"mp3-bytes",
            mime_type="audio/mpeg",
            meta={"foo": "bar"},
        ),
        blob,
    )

    assert result.audio_url == "https://cdn/meditations/m1/audio.mp3?sig=x"
    assert blob.put.await_count == 2
    keys = [call["key"] for call in blob.calls]
    assert "meditations/m1/audio.mp3" in keys
    assert "meditations/m1/meta.json" in keys
