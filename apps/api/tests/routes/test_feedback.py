from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from kokoro_api.providers.blob.base import BlobStore, PutResult
from kokoro_api.routes.feedback import register_feedback_routes


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


def _seed_meta(blob: FakeBlob, meditation_id: str) -> None:
    blob.store[f"meditations/{meditation_id}/meta.json"] = b"{}"


def _app(blob: FakeBlob) -> FastAPI:
    app = FastAPI()
    register_feedback_routes(app, blob=blob)
    return app


@pytest.mark.asyncio
async def test_feedback_recorded_for_known_meditation() -> None:
    blob = FakeBlob()
    _seed_meta(blob, "med-1")
    transport = ASGITransport(app=_app(blob))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/meditations/med-1/feedback",
            json={"liked": True, "tgUserId": 42},
        )
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    raw = blob.store["feedback/med-1.json"]
    payload = json.loads(raw.decode("utf-8"))
    assert payload["meditationId"] == "med-1"
    assert len(payload["entries"]) == 1
    assert payload["entries"][0]["liked"] is True
    assert payload["entries"][0]["tgUserId"] == 42


@pytest.mark.asyncio
async def test_feedback_appends_history() -> None:
    blob = FakeBlob()
    _seed_meta(blob, "med-2")
    transport = ASGITransport(app=_app(blob))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        await client.post("/meditations/med-2/feedback", json={"liked": True, "tgUserId": 1})
        await client.post("/meditations/med-2/feedback", json={"liked": False, "tgUserId": 1})
    raw = blob.store["feedback/med-2.json"]
    payload = json.loads(raw.decode("utf-8"))
    assert [e["liked"] for e in payload["entries"]] == [True, False]


@pytest.mark.asyncio
async def test_feedback_404_when_meditation_missing() -> None:
    transport = ASGITransport(app=_app(FakeBlob()))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/meditations/ghost/feedback",
            json={"liked": True, "tgUserId": 1},
        )
    assert res.status_code == 404
    assert res.json()["error"] == "MEDITATION_NOT_FOUND"


@pytest.mark.asyncio
async def test_feedback_accepts_anonymous() -> None:
    blob = FakeBlob()
    _seed_meta(blob, "med-3")
    transport = ASGITransport(app=_app(blob))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/meditations/med-3/feedback",
            json={"liked": True},  # no tgUserId — allowed (web users)
        )
    assert res.status_code == 200
    payload = json.loads(blob.store["feedback/med-3.json"].decode("utf-8"))
    assert payload["entries"][0]["tgUserId"] is None
