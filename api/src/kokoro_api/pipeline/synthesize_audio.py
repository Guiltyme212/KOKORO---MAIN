from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

import structlog

from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.types import Locale, VoiceId

log = structlog.get_logger()


class VoicePreset(TypedDict):
    persona_id: str
    style_hint: str


@dataclass(slots=True)
class SynthesizeAudioInput:
    lyrics: str
    style: str
    voice_id: VoiceId
    target_duration_sec: int
    reference_track_urls: list[str]
    locale: Locale


async def synthesize_audio(
    input: SynthesizeAudioInput,
    provider: MeditationAudioProvider,
    voice_presets: dict[str, VoicePreset],
) -> AudioResult:
    preset = voice_presets.get(input.voice_id)
    if preset is None:
        raise RuntimeError(
            f"no voice preset for voice_id={input.voice_id}; check voice_presets.json"
        )

    log.info(
        "audio.suno_call",
        voice_id=input.voice_id,
        locale=input.locale,
        target_duration_sec=input.target_duration_sec,
        persona_id=preset["persona_id"] or None,
        style=input.style,
        lyrics_length=len(input.lyrics),
        lyrics_full=input.lyrics,  # full text — verbose but useful for debugging
        reference_track_urls=input.reference_track_urls,
    )

    return await provider.synthesize(
        script=input.lyrics,
        voice_persona_id=preset["persona_id"],
        music_style_prompt=input.style,
        reference_track_urls=input.reference_track_urls,
        target_duration_sec=input.target_duration_sec,
        locale=input.locale,
        candidates=2,
    )
