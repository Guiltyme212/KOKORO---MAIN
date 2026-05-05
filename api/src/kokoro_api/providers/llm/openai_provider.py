from __future__ import annotations

import time
from typing import Any

import httpx

from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator


class OpenAIScriptGenerator(ScriptGenerator):
    name = "openai"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str = "https://api.openai.com/v1",
        timeout_sec: float = 120.0,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout_sec = timeout_sec

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        cache_key: str,
    ) -> LlmResult:
        _ = cache_key  # OpenAI does not have explicit prompt-cache keys
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=self._timeout_sec) as client:
            res = await client.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    # Newer OpenAI models (o-series, gpt-5, latest gpt-4o) reject
                    # `max_tokens` and require this name instead.
                    "max_completion_tokens": 4000,
                },
            )
        if res.status_code >= 400:
            raise RuntimeError(
                f"openai chat.completions failed: {res.status_code} {res.text[:500]}"
            )

        body: dict[str, Any] = res.json()
        choices = body.get("choices") or []
        if not choices:
            raise RuntimeError(f"openai returned no choices: {body}")
        content = choices[0].get("message", {}).get("content", "")
        if not isinstance(content, str) or not content:
            raise RuntimeError(f"openai returned empty content: {body}")

        usage = body.get("usage") or {}
        # OpenAI surfaces cached prompt tokens under usage.prompt_tokens_details.cached_tokens
        # for models that support automatic prompt caching (gpt-4o, gpt-4.1, etc.).
        cached = 0
        details = usage.get("prompt_tokens_details")
        if isinstance(details, dict):
            raw_cached = details.get("cached_tokens", 0)
            if isinstance(raw_cached, int):
                cached = raw_cached

        return LlmResult(
            raw_json=content,
            tokens_in=int(usage.get("prompt_tokens", 0) or 0),
            tokens_out=int(usage.get("completion_tokens", 0) or 0),
            cache_read_tokens=cached,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
