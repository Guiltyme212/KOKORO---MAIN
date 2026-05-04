from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.types import FeedbackInput, FeedbackOutput

log = structlog.get_logger()


def register_feedback_routes(app: FastAPI, *, blob: BlobStore) -> None:
    @app.post(
        "/meditations/{meditation_id}/feedback",
        response_model=FeedbackOutput,
        response_model_by_alias=True,
    )
    async def post_feedback(
        meditation_id: str,
        input: FeedbackInput,
        request: Request,
    ) -> FeedbackOutput | JSONResponse:
        # Refuse if the meditation has no meta.json — prevents poisoning the
        # store with feedback for ids that never existed.
        meta_key = f"meditations/{meditation_id}/meta.json"
        meta_bytes = await blob.get(meta_key)
        if meta_bytes is None:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "MEDITATION_NOT_FOUND",
                    "details": {"meditationId": meditation_id},
                },
            )

        # Append-only log: feedback/<meditation_id>.json holds an array.
        # Multiple submissions are kept (e.g. user changed their mind) so we
        # can compute the latest verdict and also keep history.
        feedback_key = f"feedback/{meditation_id}.json"
        existing = await blob.get(feedback_key)
        history: list[dict[str, object]] = []
        if existing is not None:
            try:
                payload = json.loads(existing.decode("utf-8"))
                if isinstance(payload, dict) and isinstance(payload.get("entries"), list):
                    history = [e for e in payload["entries"] if isinstance(e, dict)]
            except (json.JSONDecodeError, UnicodeDecodeError):
                history = []

        history.append(
            {
                "tgUserId": input.tg_user_id,
                "liked": bool(input.liked),
                "ratedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "requestId": str(uuid.uuid4()),
            }
        )

        body = json.dumps(
            {"meditationId": meditation_id, "entries": history},
            ensure_ascii=False,
            indent=2,
        )
        await blob.put(key=feedback_key, body=body, content_type="application/json")

        log.info(
            "feedback.recorded",
            meditation_id=meditation_id,
            tg_user_id=input.tg_user_id,
            liked=input.liked,
            request_origin=request.headers.get("origin"),
        )
        return FeedbackOutput(ok=True)
