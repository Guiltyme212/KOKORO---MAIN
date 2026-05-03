from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from kokoro_api.pipeline.generate_script import GenerateScriptInput, generate_script
from kokoro_api.pipeline.persist import PersistInput, persist
from kokoro_api.pipeline.resolve_capture import resolve_capture
from kokoro_api.pipeline.select_template import SelectInput, select_template
from kokoro_api.pipeline.synthesize_audio import (
    SynthesizeAudioInput,
    VoicePreset,
    synthesize_audio,
)
from kokoro_api.prompt.user import HistoryDict
from kokoro_api.providers.audio.base import MeditationAudioProvider
from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.providers.llm.base import ScriptGenerator
from kokoro_api.providers.stt.base import TranscriptionProvider
from kokoro_api.types import (
    AudioMeta,
    CaptureVoice,
    GenerateMeditationInput,
    GenerateMeditationOutput,
    PersistenceMeta,
    ProviderMeta,
    Template,
)


@dataclass(slots=True)
class PipelineDeps:
    templates: list[Template]
    stt: TranscriptionProvider
    llm: ScriptGenerator
    audio: MeditationAudioProvider
    blob: BlobStore
    voice_presets: dict[str, VoicePreset]


async def run_pipeline(
    input: GenerateMeditationInput,
    deps: PipelineDeps,
) -> GenerateMeditationOutput:
    t0 = time.monotonic()
    meditation_id = str(uuid.uuid4())

    captured = await resolve_capture(input.capture, input.locale, deps.stt)

    template = select_template(
        deps.templates,
        SelectInput(
            content_type=input.content_type,
            mode=input.mode,
            theme_text=captured.text,
            becoming=input.becoming,
        ),
    )

    history_dict: HistoryDict | None = None
    if input.history is not None:
        history_dict = {
            "previous_scripts": input.history.previous_scripts or [],
            "last_becoming": input.history.last_becoming or "",
        }

    scripted = await generate_script(
        GenerateScriptInput(
            call_me=input.call_me,
            mode=input.mode,
            capture_text=captured.text,
            becoming=input.becoming,
            template=template,
            history=history_dict,
            locale=input.locale,
        ),
        deps.llm,
    )

    audio = await synthesize_audio(
        SynthesizeAudioInput(
            script=scripted.script,
            voice_id=input.voice_id,
            template=template,
            locale=input.locale,
        ),
        deps.audio,
        deps.voice_presets,
    )

    generated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    capture_for_meta = input.capture.model_dump(by_alias=True, mode="json")
    if isinstance(input.capture, CaptureVoice):
        capture_for_meta["audioUrl"] = "<redacted>"

    meta: dict[str, object] = {
        "meditationId": meditation_id,
        "requestId": str(input.request_id),
        "generatedAt": generated_at,
        "input": {
            **input.model_dump(by_alias=True, mode="json", exclude={"capture"}),
            "capture": capture_for_meta,
        },
        "templateUsedId": template.id,
        "script": scripted.script,
        "estimatedDurationSec": scripted.estimated_duration_sec,
    }

    persisted = await persist(
        PersistInput(
            meditation_id=meditation_id,
            audio_bytes=audio.audio_bytes,
            mime_type=audio.mime_type,
            meta=meta,
        ),
        deps.blob,
    )

    provider_meta = ProviderMeta(
        transcription=captured.transcription_meta,
        llm=scripted.meta,
        audio=AudioMeta(
            provider=deps.audio.name,
            job_id=",".join(audio.job_ids),
            latency_ms=audio.latency_ms,
            candidates=audio.candidate_count,
            chosen_candidate=audio.chosen_candidate,
        ),
        persistence=PersistenceMeta(provider=deps.blob.name, latency_ms=persisted.latency_ms),
        total_latency_ms=int((time.monotonic() - t0) * 1000),
    )

    return GenerateMeditationOutput(
        meditation_id=meditation_id,
        audio_url=persisted.audio_url,
        duration_sec=audio.duration_sec,
        script=scripted.script,
        template_used_id=template.id,
        generated_at=generated_at,
        provider_meta=provider_meta,
    )
