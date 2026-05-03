from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from kokoro_api.routes.meditations import register_meditations_route
from kokoro_api.types import (
    AudioMeta,
    GenerateMeditationOutput,
    LlmMeta,
    PersistenceMeta,
    ProviderMeta,
)


def _ok_output() -> GenerateMeditationOutput:
    return GenerateMeditationOutput(
        meditation_id="m1",
        audio_url="https://cdn/x.mp3",
        duration_sec=60,
        script="Hi зай.",
        template_used_id="t",
        generated_at="now",
        provider_meta=ProviderMeta(
            llm=LlmMeta(
                provider="p",
                model="m",
                latency_ms=1,
                tokens_in=1,
                tokens_out=1,
                cache_read_tokens=0,
            ),
            audio=AudioMeta(
                provider="a",
                job_id="j",
                latency_ms=1,
                candidates=1,
                chosen_candidate=0,
            ),
            persistence=PersistenceMeta(provider="b", latency_ms=1),
            total_latency_ms=5,
        ),
    )


@pytest.mark.asyncio
async def test_returns_200_with_valid_output() -> None:
    app = FastAPI()
    register_meditations_route(app, run_pipeline=AsyncMock(return_value=_ok_output()))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        response = await client.post(
            "/meditations",
            json={
                "callMe": "зай",
                "mode": "soft",
                "capture": {"kind": "text", "text": "tired"},
                "contentType": "unwind",
                "becoming": "calm",
                "voiceId": "mira",
                "locale": "en",
                "requestId": "11111111-1111-1111-1111-111111111111",
            },
        )
        assert response.status_code == 200
        assert response.json()["audioUrl"] == "https://cdn/x.mp3"


@pytest.mark.asyncio
async def test_returns_400_on_invalid_input() -> None:
    app = FastAPI()
    register_meditations_route(app, run_pipeline=AsyncMock())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        response = await client.post("/meditations", json={"callMe": "", "mode": "soft"})
        assert response.status_code == 400
        assert response.json()["error"] == "INVALID_INPUT"
