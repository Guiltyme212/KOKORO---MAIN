from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

import structlog

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

log = structlog.get_logger()


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

    client = input.client
    bound = log.bind(
        meditation_id=meditation_id,
        request_id=str(input.request_id),
        call_me=input.call_me,
        mode=input.mode,
        content_type=input.content_type,
        becoming=input.becoming,
        voice_id=input.voice_id,
        locale=input.locale,
        capture_kind=input.capture.kind,
        source=client.source if client else "unknown",
        tg_user_id=client.tg_user_id if client else None,
        tg_username=client.tg_username if client else None,
        tg_language_code=client.tg_language_code if client else None,
        tg_is_premium=client.tg_is_premium if client else None,
    )
    bound.info("pipeline.start")

    captured = await resolve_capture(input.capture, input.locale, deps.stt)
    bound.info(
        "pipeline.captured",
        text_preview=captured.text[:300],
        text_length=len(captured.text),
        transcribed=captured.transcription_meta is not None,
        transcription_provider=(
            captured.transcription_meta.provider if captured.transcription_meta else None
        ),
    )

    template = select_template(
        deps.templates,
        SelectInput(
            content_type=input.content_type,
            mode=input.mode,
            theme_text=captured.text,
            becoming=input.becoming,
        ),
    )
    bound.info(
        "pipeline.template_picked",
        template_id=template.id,
        target_duration_sec=template.target_duration_sec,
        music_style=template.music_style_prompt[:200],
        refs_count=len(template.reference_track_urls),
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
    bound.info(
        "pipeline.script_done",
        script_preview=scripted.script[:400],
        script_length=len(scripted.script),
        estimated_duration_sec=scripted.estimated_duration_sec,
        llm_latency_ms=scripted.meta.latency_ms,
        tokens_in=scripted.meta.tokens_in,
        tokens_out=scripted.meta.tokens_out,
        cache_read_tokens=scripted.meta.cache_read_tokens,
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
    bound.info(
        "pipeline.audio_done",
        audio_bytes=len(audio.audio_bytes),
        duration_sec=audio.duration_sec,
        suno_latency_ms=audio.latency_ms,
        suno_jobs=audio.job_ids,
        chosen_candidate=audio.chosen_candidate,
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

    bound.info(
        "pipeline.done",
        audio_url=persisted.audio_url,
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
