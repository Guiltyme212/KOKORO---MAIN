from __future__ import annotations

import math
import time

import httpx

from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult
from kokoro_api.types import Locale


class WhisperProvider(TranscriptionProvider):
    name = "openai-whisper-1"

    def __init__(self, *, api_key: str, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    async def transcribe(
        self,
        *,
        audio_url: str,
        mime_type: str,
        locale: Locale,
    ) -> TranscriptionResult:
        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=60.0) as client:
            audio_res = await client.get(audio_url)
            audio_res.raise_for_status()

            files = {"file": ("audio", audio_res.content, mime_type)}
            data = {
                "model": "whisper-1",
                "language": locale,
                "response_format": "verbose_json",
            }
            res = await client.post(
                f"{self._base_url}/audio/transcriptions",
                headers={"authorization": f"Bearer {self._api_key}"},
                files=files,
                data=data,
            )
            res.raise_for_status()
            payload = res.json()

        segments = payload.get("segments") or []
        if segments:
            avg_logprob = sum(segment["avg_logprob"] for segment in segments) / len(segments)
            confidence = max(0.0, min(1.0, math.exp(avg_logprob)))
        else:
            confidence = 0.0

        return TranscriptionResult(
            text=payload["text"],
            confidence=confidence,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
