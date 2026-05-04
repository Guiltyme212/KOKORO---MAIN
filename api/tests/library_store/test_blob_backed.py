from __future__ import annotations

import json
from typing import Any

import pytest

from kokoro_api.library_store.base import MeditationNotFoundError
from kokoro_api.library_store.blob_backed import BlobLibraryStore
from kokoro_api.providers.blob.base import BlobStore, PutResult


class FakeBlob(BlobStore):
    name = "fake"

    def __init__(self) -> None:
        self.store: dict[str, bytes] = {}

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        _ = content_type
        self.store[key] = body.encode("utf-8") if isinstance(body, str) else body
        return PutResult(url=f"https://cdn/{key}", latency_ms=1)

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        _ = expiry_sec
        return f"https://cdn/{key}?sig=x"

    async def get(self, key: str) -> bytes | None:
        return self.store.get(key)


def _seed_meta(blob: FakeBlob, meditation_id: str, *, call_me: str = "зай") -> None:
    meta: dict[str, Any] = {
        "meditationId": meditation_id,
        "generatedAt": "2026-05-04T10:00:00Z",
        "audioDurationSec": 360,
        "input": {
            "callMe": call_me,
            "mode": "soft",
            "contentType": "unwind",
            "becoming": "calm",
            "capture": {"kind": "text", "text": "long day, need rest"},
        },
    }
    blob.store[f"meditations/{meditation_id}/meta.json"] = json.dumps(meta).encode("utf-8")


@pytest.mark.asyncio
async def test_list_returns_empty_for_unknown_user() -> None:
    store = BlobLibraryStore(FakeBlob())
    assert await store.list_items(123) == []


@pytest.mark.asyncio
async def test_add_persists_summary_from_meta() -> None:
    blob = FakeBlob()
    _seed_meta(blob, "med-1")
    store = BlobLibraryStore(blob)

    items = await store.add(123, "med-1")
    assert len(items) == 1
    item = items[0]
    assert item.meditation_id == "med-1"
    assert item.call_me == "зай"
    assert item.content_type == "unwind"
    assert item.becoming == "calm"
    assert item.mode == "soft"
    assert item.duration_sec == 360.0
    assert item.capture_preview == "long day, need rest"
    # Audio URL is freshly signed, not the empty stub stored in JSON.
    assert item.audio_url == "https://cdn/meditations/med-1/audio.mp3?sig=x"


@pytest.mark.asyncio
async def test_add_idempotent_moves_to_top() -> None:
    blob = FakeBlob()
    _seed_meta(blob, "med-1", call_me="a")
    _seed_meta(blob, "med-2", call_me="b")
    store = BlobLibraryStore(blob)

    await store.add(123, "med-1")
    await store.add(123, "med-2")
    items = await store.add(123, "med-1")  # re-add med-1
    assert [i.meditation_id for i in items] == ["med-1", "med-2"]
    # No duplicates — re-adding doesn't create a second entry.
    assert len(items) == 2


@pytest.mark.asyncio
async def test_add_raises_when_meta_missing() -> None:
    store = BlobLibraryStore(FakeBlob())
    with pytest.raises(MeditationNotFoundError):
        await store.add(123, "ghost")


@pytest.mark.asyncio
async def test_remove_idempotent() -> None:
    blob = FakeBlob()
    _seed_meta(blob, "med-1")
    store = BlobLibraryStore(blob)

    await store.add(123, "med-1")
    items = await store.remove(123, "med-1")
    assert items == []
    # Removing again is a no-op, not an error.
    items = await store.remove(123, "med-1")
    assert items == []


@pytest.mark.asyncio
async def test_list_resigns_audio_urls() -> None:
    blob = FakeBlob()
    _seed_meta(blob, "med-1")
    store = BlobLibraryStore(blob)
    await store.add(123, "med-1")
    items = await store.list_items(123)
    assert items[0].audio_url == "https://cdn/meditations/med-1/audio.mp3?sig=x"
