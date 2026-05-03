from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel


class LlmResult(BaseModel):
    raw_json: str
    tokens_in: int
    tokens_out: int
    cache_read_tokens: int
    latency_ms: int


class ScriptGenerator(ABC):
    name: str
    model: str

    @abstractmethod
    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        cache_key: str,
    ) -> LlmResult: ...
