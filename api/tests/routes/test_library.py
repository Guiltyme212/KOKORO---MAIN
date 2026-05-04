from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from kokoro_api.library_store.blob_backed import BlobLibraryStore
from kokoro_api.providers.blob.base import BlobStore, PutResult
from kokoro_api.routes.library import register_library_routes


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
        return f"https://cdn/{key}?sig=1"

    async def get(self, key: str) -> bytes | None:
        return self.store.get(key)


def _seed(blob: FakeBlob, meditation_id: str) -> None:
    blob.store[f"meditations/{meditation_id}/meta.json"] = json.dumps(
        {
            "meditationId": meditation_id,
            "generatedAt": "2026-05-04T10:00:00Z",
            "audioDurationSec": 300,
            "vibe": "zen",
            "input": {
                "callMe": "зай",
                "vibe": "zen",
                "capture": {"kind": "text", "text": "tired"},
            },
        }
    ).encode("utf-8")


def _app(blob: FakeBlob) -> FastAPI:
    app = FastAPI()
    register_library_routes(app, store=BlobLibraryStore(blob))
    return app


@pytest.mark.asyncio
async def test_save_returns_list_with_new_item() -> None:
    blob = FakeBlob()
    _seed(blob, "med-1")
    transport = ASGITransport(app=_app(blob))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/library/items",
            json={"meditationId": "med-1", "tgUserId": 42},
        )
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["meditationId"] == "med-1"
    assert body["items"][0]["audioUrl"].endswith("audio.mp3?sig=1")


@pytest.mark.asyncio
async def test_save_404_when_meditation_missing() -> None:
    transport = ASGITransport(app=_app(FakeBlob()))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/library/items",
            json={"meditationId": "ghost", "tgUserId": 42},
        )
    assert res.status_code == 404
    assert res.json()["error"] == "MEDITATION_NOT_FOUND"


@pytest.mark.asyncio
async def test_get_returns_users_items() -> None:
    blob = FakeBlob()
    _seed(blob, "med-1")
    transport = ASGITransport(app=_app(blob))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        await client.post("/library/items", json={"meditationId": "med-1", "tgUserId": 42})
        res = await client.get("/library", params={"tgUserId": 42})
    assert res.status_code == 200
    assert [i["meditationId"] for i in res.json()["items"]] == ["med-1"]


@pytest.mark.asyncio
async def test_get_returns_empty_for_unknown_user() -> None:
    transport = ASGITransport(app=_app(FakeBlob()))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.get("/library", params={"tgUserId": 999})
    assert res.status_code == 200
    assert res.json()["items"] == []


@pytest.mark.asyncio
async def test_delete_removes_item() -> None:
    blob = FakeBlob()
    _seed(blob, "med-1")
    transport = ASGITransport(app=_app(blob))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        await client.post("/library/items", json={"meditationId": "med-1", "tgUserId": 42})
        res = await client.request(
            "DELETE", "/library/items/med-1", json={"tgUserId": 42}
        )
    assert res.status_code == 200
    assert res.json()["items"] == []


@pytest.mark.asyncio
async def test_save_invalid_payload_returns_400() -> None:
    transport = ASGITransport(app=_app(FakeBlob()))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post("/library/items", json={"meditationId": "x"})
    assert res.status_code == 400
    assert res.json()["error"] == "INVALID_INPUT"
