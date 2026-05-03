from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import cast

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from kokoro_api.config import load_config
from kokoro_api.pipeline.orchestrator import PipelineDeps, run_pipeline
from kokoro_api.pipeline.synthesize_audio import VoicePreset
from kokoro_api.providers.audio.suno import SunoAudioProvider
from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.providers.blob.filesystem import FilesystemBlobStore
from kokoro_api.providers.blob.s3 import S3BlobStore
from kokoro_api.providers.llm.anthropic_provider import AnthropicScriptGenerator
from kokoro_api.providers.stt.base import TranscriptionProvider
from kokoro_api.providers.stt.disabled import DisabledTranscriptionProvider
from kokoro_api.providers.stt.elevenlabs import ElevenLabsTranscriptionProvider
from kokoro_api.providers.stt.whisper import WhisperProvider
from kokoro_api.routes.meditations import register_meditations_route
from kokoro_api.templates.loader import load_templates
from kokoro_api.types import GenerateMeditationInput, GenerateMeditationOutput, Template

log = structlog.get_logger()
config = load_config()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    _ = app
    log.info("kokoro_api.startup")
    yield
    log.info("kokoro_api.shutdown")


def _make_blob() -> BlobStore:
    if config.blob_driver == "s3":
        if not (
            config.blob_s3_bucket
            and config.blob_s3_endpoint
            and config.blob_s3_access_key
            and config.blob_s3_secret_key
            and config.blob_public_base_url
        ):
            raise RuntimeError(
                "s3 blob driver requires all BLOB_S3_* vars and BLOB_PUBLIC_BASE_URL"
            )
        return S3BlobStore(
            bucket=config.blob_s3_bucket,
            endpoint=str(config.blob_s3_endpoint),
            access_key=config.blob_s3_access_key,
            secret_key=config.blob_s3_secret_key,
            public_base_url=str(config.blob_public_base_url),
        )

    base = (
        str(config.blob_public_base_url)
        if config.blob_public_base_url
        else f"http://localhost:{config.port}/blob"
    )
    return FilesystemBlobStore(root_dir=config.blob_fs_dir, public_base_url=base)


def _load_voice_presets() -> dict[str, VoicePreset]:
    path = Path(__file__).parent / "providers" / "audio" / "voice_presets.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    return cast(dict[str, VoicePreset], raw)


def _make_stt() -> TranscriptionProvider:
    if config.elevenlabs_api_key:
        return ElevenLabsTranscriptionProvider(
            api_key=config.elevenlabs_api_key,
            base_url=str(config.elevenlabs_base_url),
            model=config.elevenlabs_model,
        )
    if config.whisper_api_key:
        return WhisperProvider(
            api_key=config.whisper_api_key,
            base_url=str(config.whisper_base_url),
        )
    return DisabledTranscriptionProvider()


app = FastAPI(lifespan=lifespan, title="kokoro-api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in config.cors_origin.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if config.blob_driver == "filesystem":
    Path(config.blob_fs_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/blob", StaticFiles(directory=config.blob_fs_dir), name="blob")

refs_dir = Path("refs")
if refs_dir.exists():
    app.mount("/refs", StaticFiles(directory=refs_dir), name="refs")

stt = _make_stt()
llm = AnthropicScriptGenerator(
    base_url=str(config.anthropic_base_url),
    api_key=config.anthropic_api_key,
    model=config.anthropic_model,
)
audio = SunoAudioProvider(
    base_url=str(config.suno_base_url),
    api_key=config.suno_api_key,
    callback_url=str(config.suno_callback_url),
)
blob = _make_blob()
voice_presets = _load_voice_presets()
_templates_cache: list[Template] = []


async def _ensure_templates_loaded() -> list[Template]:
    if not _templates_cache:
        _templates_cache.extend(_resolve_reference_urls(await load_templates()))
    return _templates_cache


def _resolve_reference_urls(templates: list[Template]) -> list[Template]:
    base = (
        str(config.reference_public_base_url).rstrip("/")
        if config.reference_public_base_url
        else f"http://localhost:{config.port}/refs"
    )
    resolved: list[Template] = []
    for template in templates:
        refs = []
        for ref in template.reference_track_urls:
            if ref.startswith(("http://", "https://")):
                refs.append(ref)
            else:
                refs.append(f"{base}/{ref.lstrip('/')}")
        resolved.append(template.model_copy(update={"reference_track_urls": refs}))
    return resolved


async def _run(input: GenerateMeditationInput) -> GenerateMeditationOutput:
    templates = await _ensure_templates_loaded()
    deps = PipelineDeps(
        templates=templates,
        stt=stt,
        llm=llm,
        audio=audio,
        blob=blob,
        voice_presets=voice_presets,
    )
    return await run_pipeline(input, deps)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "ts": int(time.time() * 1000)}


@app.post("/suno/callback")
async def suno_callback(payload: dict[str, object]) -> dict[str, bool]:
    _ = payload
    return {"ok": True}


register_meditations_route(app, run_pipeline=_run)


def serve() -> None:
    import uvicorn

    uvicorn.run(
        "kokoro_api.main:app",
        host="0.0.0.0",  # noqa: S104 - Railway containers must bind all interfaces.
        port=config.port,
        log_level=config.log_level,
    )


if __name__ == "__main__":
    serve()
