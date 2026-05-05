from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Awaitable, Callable

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse

from kokoro_api.types import (
    GenerateMeditationInput,
    GenerateMeditationOutput,
    StreamErrorEvent,
    StreamReadyEvent,
    StreamScriptEvent,
    StreamStreamingEvent,
)

log = structlog.get_logger()

PipelineFn = Callable[[GenerateMeditationInput], Awaitable[GenerateMeditationOutput]]
PipelineEvent = StreamScriptEvent | StreamStreamingEvent | StreamReadyEvent
StreamPipelineFn = Callable[[GenerateMeditationInput], AsyncIterator[PipelineEvent]]


def register_meditations_route(
    app: FastAPI,
    *,
    run_pipeline: PipelineFn,
    run_pipeline_streaming: StreamPipelineFn,
) -> None:
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

    @app.post("/meditations/stream")
    async def post_meditation_stream(input: GenerateMeditationInput) -> StreamingResponse:
        async def generator() -> AsyncIterator[bytes]:
            try:
                async for event in run_pipeline_streaming(input):
                    yield (event.model_dump_json(by_alias=True) + "\n").encode("utf-8")
            except TimeoutError as exc:
                err = StreamErrorEvent(
                    error="UPSTREAM_TIMEOUT",
                    details={"stage": "audio", "message": str(exc)},
                )
                yield (err.model_dump_json(by_alias=True) + "\n").encode("utf-8")
            except RuntimeError as exc:
                msg = str(exc)
                if "no candidate" in msg:
                    err = StreamErrorEvent(
                        error="AUDIO_GEN_FAILED",
                        details={"reason": msg},
                    )
                elif "rate limit" in msg.lower():
                    err = StreamErrorEvent(
                        error="UPSTREAM_RATE_LIMIT",
                        details={"retryAfterSec": 30},
                    )
                else:
                    trace_id = str(uuid.uuid4())
                    log.exception("meditations.stream.runtime_error", trace_id=trace_id)
                    err = StreamErrorEvent(
                        error="INTERNAL",
                        details={"traceId": trace_id, "message": msg},
                    )
                yield (err.model_dump_json(by_alias=True) + "\n").encode("utf-8")
            except Exception as exc:  # noqa: BLE001 - convert to wire error
                trace_id = str(uuid.uuid4())
                log.exception("meditations.stream.unhandled", trace_id=trace_id)
                err = StreamErrorEvent(
                    error="INTERNAL",
                    details={"traceId": trace_id, "message": str(exc)},
                )
                yield (err.model_dump_json(by_alias=True) + "\n").encode("utf-8")

        return StreamingResponse(
            generator(),
            media_type="application/x-ndjson",
            headers={
                "X-Accel-Buffering": "no",
                "Cache-Control": "no-cache",
            },
        )
