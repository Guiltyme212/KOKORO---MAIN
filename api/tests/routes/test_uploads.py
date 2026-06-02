from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from kokoro_api.providers.blob.base import BlobStore, PutResult
from kokoro_api.routes.uploads import register_uploads_route


class FakeBlob(BlobStore):
    name = "fake"

    def __init__(self) -> None:
        self.store: dict[str, bytes] = {}
        self.put_calls: list[dict[str, object]] = []

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        self.put_calls.append({"key": key, "content_type": content_type, "size": len(body)})
        self.store[key] = body if isinstance(body, bytes) else body.encode("utf-8")
        return PutResult(url=f"https://cdn/{key}", latency_ms=1)

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        _ = expiry_sec
        return f"https://cdn/{key}?sig=x"

    async def get(self, key: str) -> bytes | None:
        return self.store.get(key)


def _app(blob: FakeBlob) -> FastAPI:
    app = FastAPI()
    register_uploads_route(app, blob=blob)
    return app


@pytest.mark.asyncio
async def test_upload_audio_webm_succeeds() -> None:
    blob = FakeBlob()
    transport = ASGITransport(app=_app(blob))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/uploads",
            files={"file": ("clip.webm", b"\x1a\x45\xdf\xa3" + b"audio-bytes" * 50, "audio/webm")},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["mimeType"] == "audio/webm"
    assert body["key"].startswith("captures/")
    assert body["key"].endswith(".webm")
    assert body["audioUrl"].endswith("?sig=x")
    assert len(blob.put_calls) == 1


@pytest.mark.asyncio
async def test_upload_rejects_non_audio_mime() -> None:
    transport = ASGITransport(app=_app(FakeBlob()))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/uploads",
            files={"file": ("x.txt", b"hello", "text/plain")},
        )
    assert res.status_code == 415


@pytest.mark.asyncio
async def test_upload_rejects_empty_body() -> None:
    transport = ASGITransport(app=_app(FakeBlob()))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post(
            "/uploads",
            files={"file": ("x.webm", b"", "audio/webm")},
        )
    assert res.status_code == 400
