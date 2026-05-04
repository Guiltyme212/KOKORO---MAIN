from __future__ import annotations

from dataclasses import dataclass

import structlog

from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.types import Locale

log = structlog.get_logger()


@dataclass(slots=True)
class SynthesizeAudioInput:
    lyrics: str
    style: str
    target_duration_sec: int
    reference_track_urls: list[str]
    locale: Locale


async def synthesize_audio(
    input: SynthesizeAudioInput,
    provider: MeditationAudioProvider,
) -> AudioResult:
    """Vibe-aware Suno call. The vocal character comes entirely from the
    reference clip Suno hears via upload-cover; we no longer maintain a
    separate persona / voiceId dimension."""
    log.info(
        "audio.suno_call",
        locale=input.locale,
        target_duration_sec=input.target_duration_sec,
        style=input.style,
        lyrics_length=len(input.lyrics),
        lyrics_full=input.lyrics,
        reference_track_urls=input.reference_track_urls,
    )

    return await provider.synthesize(
        script=input.lyrics,
        voice_persona_id="",  # personas removed; reference clip drives the voice
        music_style_prompt=input.style,
        reference_track_urls=input.reference_track_urls,
        target_duration_sec=input.target_duration_sec,
        locale=input.locale,
        candidates=2,
    )
