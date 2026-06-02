from __future__ import annotations

import asyncio
import contextlib
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
    StreamPingEvent,
    StreamReadyEvent,
    StreamScriptEvent,
    StreamStreamingEvent,
)

log = structlog.get_logger()

# Emit a keep-alive heartbeat at least this often during the byte-silent LLM /
# Suno waits, so the NDJSON connection never goes idle long enough for the
# Railway edge or iOS WKWebView to drop it.
STREAM_HEARTBEAT_SEC = 10.0

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
            # Run the pipeline in a background task feeding a queue, and emit a
            # heartbeat whenever the queue stays silent for STREAM_HEARTBEAT_SEC.
            # This keeps the NDJSON connection warm through the long, byte-silent
            # LLM and Suno-polling waits — otherwise an idle edge/WKWebView
            # timeout drops the socket (Suno still finishes server-side, so the
            # user saw "could not reach" despite a successful generation).
            queue: asyncio.Queue[
                StreamScriptEvent
                | StreamStreamingEvent
                | StreamReadyEvent
                | StreamErrorEvent
                | None
            ] = asyncio.Queue()

            async def produce() -> None:
                try:
                    async for event in run_pipeline_streaming(input):
                        await queue.put(event)
                except TimeoutError as exc:
                    await queue.put(
                        StreamErrorEvent(
                            error="UPSTREAM_TIMEOUT",
                            details={"stage": "audio", "message": str(exc)},
                        )
                    )
                except RuntimeError as exc:
                    msg = str(exc)
                    if "no candidate" in msg:
                        await queue.put(
                            StreamErrorEvent(error="AUDIO_GEN_FAILED", details={"reason": msg})
                        )
                    elif "rate limit" in msg.lower():
                        await queue.put(
                            StreamErrorEvent(
                                error="UPSTREAM_RATE_LIMIT", details={"retryAfterSec": 30}
                            )
                        )
                    else:
                        trace_id = str(uuid.uuid4())
                        log.exception("meditations.stream.runtime_error", trace_id=trace_id)
                        await queue.put(
                            StreamErrorEvent(
                                error="INTERNAL",
                                details={"traceId": trace_id, "message": msg},
                            )
                        )
                except Exception as exc:
                    trace_id = str(uuid.uuid4())
                    log.exception("meditations.stream.unhandled", trace_id=trace_id)
                    await queue.put(
                        StreamErrorEvent(
                            error="INTERNAL",
                            details={"traceId": trace_id, "message": str(exc)},
                        )
                    )
                finally:
                    await queue.put(None)

            ping = (StreamPingEvent().model_dump_json(by_alias=True) + "\n").encode("utf-8")
            task = asyncio.create_task(produce())
            try:
                while True:
                    try:
                        item = await asyncio.wait_for(
                            queue.get(), timeout=STREAM_HEARTBEAT_SEC
                        )
                    except TimeoutError:
                        yield ping  # nothing yet — keep the socket warm
                        continue
                    if item is None:
                        break
                    yield (item.model_dump_json(by_alias=True) + "\n").encode("utf-8")
            finally:
                # Client gone or stream done: stop polling Suno.
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

        return StreamingResponse(
            generator(),
            media_type="application/x-ndjson",
            headers={
                "X-Accel-Buffering": "no",
                "Cache-Control": "no-cache",
            },
        )
