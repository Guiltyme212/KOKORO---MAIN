from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from kokoro_api.auth.dependencies import require_subscription_access
from kokoro_api.auth.models import CurrentUser
from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.types import FeedbackInput, FeedbackOutput, FeedbackV1Input

log = structlog.get_logger()


def register_feedback_routes(app: FastAPI, *, blob: BlobStore) -> None:
    async def record_feedback(
        meditation_id: str,
        *,
        liked: bool,
        identity: dict[str, object],
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
                **identity,
                "liked": bool(liked),
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
            liked=liked,
            request_origin=request.headers.get("origin"),
        )
        return FeedbackOutput(ok=True)

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
        return await record_feedback(
            meditation_id,
            liked=input.liked,
            identity={"tgUserId": input.tg_user_id},
            request=request,
        )

    @app.post(
        "/v1/meditations/{meditation_id}/feedback",
        response_model=FeedbackOutput,
        response_model_by_alias=True,
    )
    async def post_web_feedback(
        meditation_id: str,
        input: FeedbackV1Input,
        request: Request,
        _user: Annotated[CurrentUser, Depends(require_subscription_access)],
    ) -> FeedbackOutput | JSONResponse:
        return await record_feedback(
            meditation_id,
            liked=input.liked,
            identity={},
            request=request,
        )
