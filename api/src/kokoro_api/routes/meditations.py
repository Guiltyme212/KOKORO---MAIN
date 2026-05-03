from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from kokoro_api.types import GenerateMeditationInput, GenerateMeditationOutput

PipelineFn = Callable[[GenerateMeditationInput], Awaitable[GenerateMeditationOutput]]


def register_meditations_route(app: FastAPI, *, run_pipeline: PipelineFn) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_req: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"error": "INVALID_INPUT", "details": exc.errors()},
        )

    @app.post("/meditations", response_model=GenerateMeditationOutput, response_model_by_alias=True)
    async def post_meditation(
        input: GenerateMeditationInput,
    ) -> GenerateMeditationOutput | JSONResponse:
        try:
            return await run_pipeline(input)
        except TimeoutError as exc:
            return JSONResponse(
                status_code=504,
                content={
                    "error": "UPSTREAM_TIMEOUT",
                    "details": {"stage": "audio", "message": str(exc)},
                },
            )
        except RuntimeError as exc:
            msg = str(exc)
            if "no candidate" in msg:
                return JSONResponse(
                    status_code=422,
                    content={"error": "AUDIO_GEN_FAILED", "details": {"reason": msg}},
                )
            if "rate limit" in msg.lower():
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "UPSTREAM_RATE_LIMIT",
                        "details": {"retryAfterSec": 30},
                    },
                )
            return JSONResponse(
                status_code=500,
                content={
                    "error": "INTERNAL",
                    "details": {"traceId": str(uuid.uuid4()), "message": msg},
                },
            )
        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "INTERNAL",
                    "details": {"traceId": str(uuid.uuid4()), "message": str(exc)},
                },
            )
