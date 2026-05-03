from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel

from kokoro_api.types import Locale


class TranscriptionResult(BaseModel):
    text: str
    confidence: float
    latency_ms: int


class TranscriptionProvider(ABC):
    name: str

    @abstractmethod
    async def transcribe(
        self,
        *,
        audio_url: str,
        mime_type: str,
        locale: Locale,
    ) -> TranscriptionResult: ...
