from __future__ import annotations

import os

import httpx
import pytest

from kokoro_api.providers.llm.openai_provider import OpenAIScriptGenerator


@pytest.mark.asyncio
async def test_parses_chat_completion_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/chat/completions")
        assert request.headers["authorization"] == "Bearer test-key"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"style":"x","lyrics":"y"}'}}],
                "usage": {
                    "prompt_tokens": 12,
                    "completion_tokens": 7,
                    "prompt_tokens_details": {"cached_tokens": 4},
                },
            },
        )

    transport = httpx.MockTransport(handler)
    generator = OpenAIScriptGenerator(api_key="test-key", model="gpt-4o")
    # Patch the client constructor to use the mock transport
    real_client = httpx.AsyncClient

    def make_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        _ = args, kwargs
        return real_client(transport=transport)

    import kokoro_api.providers.llm.openai_provider as mod

    mod.httpx.AsyncClient = make_client  # type: ignore[assignment]
    try:
        result = await generator.generate(
            system_prompt="sys", user_prompt="usr", cache_key="k"
        )
    finally:
        mod.httpx.AsyncClient = real_client  # type: ignore[assignment]

    assert result.raw_json == '{"style":"x","lyrics":"y"}'
    assert result.tokens_in == 12
    assert result.tokens_out == 7
    assert result.cache_read_tokens == 4
    assert result.latency_ms >= 0


@pytest.mark.asyncio
async def test_raises_on_http_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        _ = request
        return httpx.Response(401, json={"error": {"message": "bad key"}})

    transport = httpx.MockTransport(handler)
    generator = OpenAIScriptGenerator(api_key="bad", model="gpt-4o")
    real_client = httpx.AsyncClient

    def make_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        _ = args, kwargs
        return real_client(transport=transport)

    import kokoro_api.providers.llm.openai_provider as mod

    mod.httpx.AsyncClient = make_client  # type: ignore[assignment]
    try:
        with pytest.raises(RuntimeError, match=r"openai chat\.completions failed"):
            await generator.generate(system_prompt="s", user_prompt="u", cache_key="k")
    finally:
        mod.httpx.AsyncClient = real_client  # type: ignore[assignment]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_returns_json_against_real_openai() -> None:
    generator = OpenAIScriptGenerator(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-4o"),
    )
    result = await generator.generate(
        system_prompt='You output strict JSON. Return {"ok": true}.',
        user_prompt="Return ok.",
        cache_key="test",
    )
    assert result.raw_json
    assert result.tokens_out > 0
