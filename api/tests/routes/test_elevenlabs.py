from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from kokoro_api.routes import elevenlabs
from kokoro_api.routes.elevenlabs import register_elevenlabs_routes


def _app(*, api_key: str | None = "x" * 24, agent_id: str | None = "agent_123") -> FastAPI:
    app = FastAPI()
    register_elevenlabs_routes(
        app,
        api_key=api_key,
        base_url="https://api.elevenlabs.io",
        agent_id=agent_id,
        branch_id="agtbrch_123",
        environment="production",
    )
    return app


@pytest.mark.asyncio
async def test_token_route_requires_agent_config() -> None:
    transport = ASGITransport(app=_app(api_key=None))
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.get("/elevenlabs/conversation-token")

    assert res.status_code == 503
    assert res.json()["error"] == "ELEVENLABS_AGENT_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_token_route_returns_upstream_token(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []

    class FakeResponse:
        is_success = True
        status_code = 200
        text = ""

        @staticmethod
        def json() -> dict[str, str]:
            return {"token": "conversation-token"}

    class FakeClient:
        def __init__(self, *, timeout: float) -> None:
            self.timeout = timeout

        async def __aenter__(self) -> FakeClient:
            return self

        async def __aexit__(self, *_exc: object) -> None:
            return None

        async def get(
            self,
            url: str,
            *,
            headers: dict[str, str],
            params: dict[str, str],
        ) -> FakeResponse:
            calls.append({"url": url, "headers": headers, "params": params})
            return FakeResponse()

    monkeypatch.setattr(elevenlabs.httpx, "AsyncClient", FakeClient)

    transport = ASGITransport(app=_app())
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.get("/elevenlabs/conversation-token?participantName=Danny")

    assert res.status_code == 200
    assert res.json() == {"token": "conversation-token"}
    assert res.headers["cache-control"] == "no-store"
    assert calls[0]["params"] == {
        "agent_id": "agent_123",
        "environment": "production",
        "branch_id": "agtbrch_123",
        "participant_name": "Danny",
    }
