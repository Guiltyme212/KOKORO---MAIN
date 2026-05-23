from __future__ import annotations

import uuid

import structlog
from fastapi import FastAPI, File, HTTPException, UploadFile

from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.types import UploadResponse

log = structlog.get_logger()

# Acceptable MIME prefixes for user-recorded captures. Chrome MediaRecorder
# typically produces audio/webm; Safari prefers audio/mp4. We don't try to
# convert — just reject anything else so we don't accumulate weird blobs.
ALLOWED_MIME_PREFIXES = ("audio/",)
MAX_BYTES = 10 * 1024 * 1024  # 10 MB; user captures shouldn't exceed ~60s


def _ext_for(mime: str) -> str:
    """Best-effort extension picker for the saved blob filename."""
    mime = mime.lower().split(";", 1)[0].strip()
    if mime in {"audio/webm", "audio/webm;codecs=opus"}:
        return "webm"
    if mime in {"audio/mp4", "audio/x-m4a", "audio/aac"}:
        return "m4a"
    if mime in {"audio/mpeg", "audio/mp3"}:
        return "mp3"
    if mime in {"audio/ogg", "audio/ogg;codecs=opus"}:
        return "ogg"
    if mime in {"audio/wav", "audio/x-wav"}:
        return "wav"
    return "bin"


def register_uploads_route(app: FastAPI, *, blob: BlobStore) -> None:
    @app.post("/uploads", response_model=UploadResponse, response_model_by_alias=True)
    async def upload_capture(
        file: UploadFile = File(...),  # noqa: B008  FastAPI dependency injection
    ) -> UploadResponse:
        mime = (file.content_type or "").lower()
        if not any(mime.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
            raise HTTPException(status_code=415, detail=f"unsupported mime type: {mime!r}")

        body = await file.read()
        if not body:
            raise HTTPException(status_code=400, detail="empty file")
        if len(body) > MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"file too large: {len(body)} > {MAX_BYTES}",
            )

        capture_id = str(uuid.uuid4())
        key = f"captures/{capture_id}.{_ext_for(mime)}"
        await blob.put(key=key, body=body, content_type=mime)
        url = await blob.signed_url(key, 60 * 60 * 24 * 30)

        log.info(
            "uploads.capture",
            key=key,
            mime=mime,
            bytes=len(body),
        )

        return UploadResponse(audio_url=url, key=key, mime_type=mime)
