from __future__ import annotations

import os

import pytest

from kokoro_api.providers.llm.anthropic_provider import AnthropicScriptGenerator


def test_normalizes_cliproxy_base_url_to_claude_provider_route() -> None:
    assert (
        AnthropicScriptGenerator._normalize_base_url(
            "https://ourcliproxy-production.up.railway.app/",
        )
        == "https://ourcliproxy-production.up.railway.app/api/provider/claude"
    )
    assert (
        AnthropicScriptGenerator._normalize_base_url(
            "https://ourcliproxy-production.up.railway.app/api/provider/claude",
        )
        == "https://ourcliproxy-production.up.railway.app/api/provider/claude"
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_returns_json_and_token_counts() -> None:
    generator = AnthropicScriptGenerator(
        base_url=os.environ["ANTHROPIC_BASE_URL"],
        api_key=os.environ["ANTHROPIC_API_KEY"],
        model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-7"),
    )
    result = await generator.generate(
        system_prompt='You output strict JSON. Return {"ok": true}.',
        user_prompt="Return ok.",
        cache_key="test",
    )
    assert result.raw_json
    assert result.tokens_out > 0
