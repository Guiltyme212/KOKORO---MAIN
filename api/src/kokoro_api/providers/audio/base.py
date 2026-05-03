from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal

from pydantic import BaseModel

from kokoro_api.types import Locale


class AudioResult(BaseModel):
    audio_bytes: bytes
    mime_type: Literal["audio/mpeg"]
    duration_sec: int
    job_ids: list[str]
    candidate_count: int
    chosen_candidate: int
    latency_ms: int


class MeditationAudioProvider(ABC):
    name: str

    @abstractmethod
    async def synthesize(
        self,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Locale,
        candidates: int,
    ) -> AudioResult: ...
