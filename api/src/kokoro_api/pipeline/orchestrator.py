from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

import structlog

from kokoro_api.pipeline.generate_meditation import (
    GenerateMeditationInput as WriterInput,
)
from kokoro_api.pipeline.generate_meditation import generate_meditation
from kokoro_api.pipeline.persist import PersistInput, persist
from kokoro_api.pipeline.resolve_capture import resolve_capture
from kokoro_api.pipeline.select_template import select_template
from kokoro_api.pipeline.synthesize_audio import (
    SynthesizeAudioInput,
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
        vibe=input.vibe,
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

    template = select_template(deps.templates, input.vibe)
    bound.info(
        "pipeline.template_selected",
        template_id=template.id,
        vibe=template.vibe,
        target_duration_sec=template.target_duration_sec,
        refs_count=len(template.reference_track_urls),
    )

    history_dict: HistoryDict | None = None
    if input.history is not None:
        history_dict = {
            "previous_scripts": input.history.previous_scripts or [],
        }
        if input.history.last_vibe is not None:
            history_dict["last_vibe"] = input.history.last_vibe

    written = await generate_meditation(
        WriterInput(
            call_me=input.call_me,
            capture_text=captured.text,
            template=template,
            history=history_dict,
            locale=input.locale,
        ),
        deps.llm,
    )
    bound.info(
        "pipeline.script_done",
        style=written.style,
        lyrics_full=written.lyrics,
        lyrics_length=len(written.lyrics),
        estimated_duration_sec=written.estimated_duration_sec,
        validation_warnings=written.validation_warnings,
        writer_latency_ms=written.meta.latency_ms,
        tokens_in=written.meta.tokens_in,
        tokens_out=written.meta.tokens_out,
        cache_read_tokens=written.meta.cache_read_tokens,
    )

    audio = await synthesize_audio(
        SynthesizeAudioInput(
            lyrics=written.lyrics,
            style=written.style,
            target_duration_sec=template.target_duration_sec,
            reference_track_urls=[str(u) for u in template.reference_track_urls],
            locale=input.locale,
        ),
        deps.audio,
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
        "vibe": template.vibe,
        "style": written.style,
        "lyrics": written.lyrics,
        "estimatedDurationSec": written.estimated_duration_sec,
        "audioDurationSec": audio.duration_sec,
        "validationWarnings": written.validation_warnings,
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
        llm=written.meta,
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
        style=written.style,
        lyrics=written.lyrics,
        vibe=template.vibe,
        template_id=template.id,
        generated_at=generated_at,
        provider_meta=provider_meta,
    )
