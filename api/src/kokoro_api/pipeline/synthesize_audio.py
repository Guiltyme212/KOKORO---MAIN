from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

import structlog

from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.types import Locale, Template, VoiceId

log = structlog.get_logger()


class VoicePreset(TypedDict):
    persona_id: str
    style_hint: str


@dataclass(slots=True)
class SynthesizeAudioInput:
    script: str
    voice_id: VoiceId
    template: Template
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

    style_prompt = f"{preset['style_hint']}; {input.template.music_style_prompt}"

    log.info(
        "audio.suno_call",
        template_id=input.template.id,
        voice_id=input.voice_id,
        locale=input.locale,
        target_duration_sec=input.template.target_duration_sec,
        persona_id=preset["persona_id"] or None,
        style_prompt=style_prompt,
        script_length=len(input.script),
        script_full=input.script,  # full text — verbose but useful for debugging
        reference_track_urls=[str(u) for u in input.template.reference_track_urls],
    )

    return await provider.synthesize(
        script=input.script,
        voice_persona_id=preset["persona_id"],
        music_style_prompt=style_prompt,
        reference_track_urls=[str(url) for url in input.template.reference_track_urls],
        target_duration_sec=input.template.target_duration_sec,
        locale=input.locale,
        candidates=2,
    )
