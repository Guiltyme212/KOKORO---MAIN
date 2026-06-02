from __future__ import annotations

import math
import time

import httpx

from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult
from kokoro_api.types import Locale


class ElevenLabsTranscriptionProvider(TranscriptionProvider):
    name = "elevenlabs-scribe"

    def __init__(self, *, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def transcribe(
        self,
        *,
        audio_url: str,
        mime_type: str,
        locale: Locale,
    ) -> TranscriptionResult:
        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=90.0) as client:
            audio_res = await client.get(audio_url)
            audio_res.raise_for_status()

            files = {"file": ("audio", audio_res.content, mime_type)}
            data = {
                "model_id": self._model,
                "language_code": locale,
                "tag_audio_events": "false",
                "diarize": "false",
                "timestamps_granularity": "none",
            }
            if self._model == "scribe_v2":
                data["no_verbatim"] = "true"

            res = await client.post(
                f"{self._base_url}/v1/speech-to-text",
                headers={"xi-api-key": self._api_key},
                files=files,
                data=data,
            )
            res.raise_for_status()
            payload = res.json()

        return TranscriptionResult(
            text=payload["text"],
            confidence=self._confidence(payload),
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    @staticmethod
    def _confidence(payload: dict[str, object]) -> float:
        words = payload.get("words")
        if isinstance(words, list):
            logprobs = [
                word["logprob"]
                for word in words
                if isinstance(word, dict) and isinstance(word.get("logprob"), int | float)
            ]
            if logprobs:
                avg_logprob = sum(logprobs) / len(logprobs)
                return max(0.0, min(1.0, math.exp(avg_logprob)))

        language_probability = payload.get("language_probability")
        if isinstance(language_probability, int | float):
            return max(0.0, min(1.0, float(language_probability)))

        return 0.0
