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


async def _empty_stream(_input):  # type: ignore[no-untyped-def]
    if False:
        yield


def _ok_output() -> GenerateMeditationOutput:
    return GenerateMeditationOutput(
        meditation_id="m1",
        audio_url="https://cdn/x.mp3",
        duration_sec=60,
        style="Russian spoken-word guided meditation, no singing",
        lyrics="[Intro: ambient, no singing]\n[Spoken word, slow]\nЗай.",
        vibe="zen",
        template_id="vibe_zen_01",
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
    register_meditations_route(
        app,
        run_pipeline=AsyncMock(return_value=_ok_output()),
        run_pipeline_streaming=_empty_stream,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        response = await client.post(
            "/meditations",
            json={
                "callMe": "Зай",
                "capture": {"kind": "text", "text": "tired"},
                "vibe": "zen",
                "locale": "ru",
                "requestId": "11111111-1111-1111-1111-111111111111",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["audioUrl"] == "https://cdn/x.mp3"
        assert body["lyrics"].startswith("[Intro: ambient, no singing]")
        assert "spoken-word" in body["style"]
        assert body["vibe"] == "zen"
        assert body["templateId"] == "vibe_zen_01"


@pytest.mark.asyncio
async def test_returns_400_on_invalid_input() -> None:
    app = FastAPI()
    register_meditations_route(
        app,
        run_pipeline=AsyncMock(),
        run_pipeline_streaming=_empty_stream,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        response = await client.post("/meditations", json={"callMe": "", "vibe": "zen"})
        assert response.status_code == 400
        assert response.json()["error"] == "INVALID_INPUT"
