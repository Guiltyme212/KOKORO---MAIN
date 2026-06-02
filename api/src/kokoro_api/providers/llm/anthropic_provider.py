from __future__ import annotations

import time
from typing import Any, cast

from anthropic import AsyncAnthropic
from anthropic.types import TextBlock

from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator


class AnthropicScriptGenerator(ScriptGenerator):
    name = "anthropic"

    def __init__(self, *, base_url: str, api_key: str, model: str) -> None:
        self.model = model
        self._client = AsyncAnthropic(base_url=self._normalize_base_url(base_url), api_key=api_key)

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        cache_key: str,
    ) -> LlmResult:
        _ = cache_key
        t0 = time.monotonic()
        res = await self._client.messages.create(
            model=self.model,
            max_tokens=4000,
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                },
            ],
            messages=[{"role": "user", "content": user_prompt}],
        )

        text = "".join(block.text for block in res.content if isinstance(block, TextBlock))
        usage = cast(Any, res.usage)

        return LlmResult(
            raw_json=text,
            tokens_in=res.usage.input_tokens,
            tokens_out=res.usage.output_tokens,
            cache_read_tokens=usage.cache_read_input_tokens or 0,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    @staticmethod
    def _normalize_base_url(base_url: str) -> str:
        clean = base_url.rstrip("/")
        if clean.endswith("/v1") or "/api/provider/" in clean:
            return clean
        return f"{clean}/api/provider/claude"
