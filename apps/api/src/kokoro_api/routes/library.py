from __future__ import annotations

import uuid

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from kokoro_api.library_store.base import LibraryStore, MeditationNotFoundError
from kokoro_api.types import (
    LibraryListOutput,
    LibraryRemoveInput,
    LibrarySaveInput,
)


def register_library_routes(app: FastAPI, *, store: LibraryStore) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_req: Request, exc: RequestValidationError) -> JSONResponse:
        # Library endpoints share the same INVALID_INPUT shape as /meditations.
        # Note: meditations.py registers the same handler — keep them aligned;
        # last registration wins, but the response body is identical.
        return JSONResponse(
            status_code=400,
            content={"error": "INVALID_INPUT", "details": exc.errors()},
        )

    @app.post("/library/items", response_model=LibraryListOutput, response_model_by_alias=True)
    async def save_to_library(input: LibrarySaveInput) -> LibraryListOutput | JSONResponse:
        try:
            items = await store.add(input.tg_user_id, input.meditation_id)
        except MeditationNotFoundError as exc:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "MEDITATION_NOT_FOUND",
                    "details": {"meditationId": input.meditation_id, "message": str(exc)},
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
        return LibraryListOutput(items=items)

    @app.get("/library", response_model=LibraryListOutput, response_model_by_alias=True)
    async def list_library(
        tg_user_id: int = Query(..., alias="tgUserId"),
    ) -> LibraryListOutput | JSONResponse:
        try:
            items = await store.list_items(tg_user_id)
        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "INTERNAL",
                    "details": {"traceId": str(uuid.uuid4()), "message": str(exc)},
                },
            )
        return LibraryListOutput(items=items)

    @app.delete(
        "/library/items/{meditation_id}",
        response_model=LibraryListOutput,
        response_model_by_alias=True,
    )
    async def remove_from_library(
        meditation_id: str,
        input: LibraryRemoveInput,
    ) -> LibraryListOutput | JSONResponse:
        try:
            items = await store.remove(input.tg_user_id, meditation_id)
        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "INTERNAL",
                    "details": {"traceId": str(uuid.uuid4()), "message": str(exc)},
                },
            )
        return LibraryListOutput(items=items)
