from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
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


@dataclass(slots=True)
class StreamReady:
    """Emitted by `synthesize_streaming` as soon as a playable streaming URL
    is available — typically 20-40s after submit, before final mastering."""

    stream_audio_url: str
    duration_sec: int
    candidate_id: str
    job_id: str


# An async generator may yield ("stream", StreamReady) once, then ("final",
# AudioResult) once. Providers without a streaming concept yield only the
# "final" tuple — see the default in `MeditationAudioProvider`.
SynthesizeEvent = tuple[Literal["stream"], StreamReady] | tuple[Literal["final"], AudioResult]


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

    async def synthesize_streaming(
        self,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Locale,
        candidates: int,
    ) -> AsyncIterator[SynthesizeEvent]:
        """Default: provider has no streaming stage — wait for the final
        result and yield it as a single 'final' event. Overridden by Suno
        when configured against sunoapi.org."""
        result = await self.synthesize(
            script=script,
            voice_persona_id=voice_persona_id,
            music_style_prompt=music_style_prompt,
            reference_track_urls=reference_track_urls,
            target_duration_sec=target_duration_sec,
            locale=locale,
            candidates=candidates,
        )
        yield ("final", result)
