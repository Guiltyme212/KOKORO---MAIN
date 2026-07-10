from __future__ import annotations

import httpx
from fastapi import Depends, FastAPI, Query
from fastapi.responses import JSONResponse

from kokoro_api.auth.dependencies import require_subscription_access


def register_elevenlabs_routes(
    app: FastAPI,
    *,
    api_key: str | None,
    base_url: str,
    agent_id: str | None,
    branch_id: str | None,
    environment: str,
) -> None:
    @app.get("/elevenlabs/conversation-token")
    async def get_conversation_token(
        participant_name: str | None = Query(default=None, alias="participantName"),
    ) -> JSONResponse:
        if not api_key or not agent_id:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "ELEVENLABS_AGENT_NOT_CONFIGURED",
                    "details": {"missing": ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID"]},
                },
            )

        params = {
            "agent_id": agent_id,
            "environment": environment,
        }
        if branch_id:
            params["branch_id"] = branch_id
        if participant_name:
            params["participant_name"] = participant_name[:80]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(
                    f"{base_url.rstrip('/')}/v1/convai/conversation/token",
                    headers={"xi-api-key": api_key},
                    params=params,
                )
        except httpx.HTTPError as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ELEVENLABS_UNAVAILABLE",
                    "details": {"message": str(exc)},
                },
            )

        if not res.is_success:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ELEVENLABS_TOKEN_FAILED",
                    "details": {"status": res.status_code, "message": res.text[:500]},
                },
            )

        payload = res.json()
        token = payload.get("token")
        if not isinstance(token, str) or not token:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ELEVENLABS_TOKEN_INVALID",
                    "details": {"message": "token missing from upstream response"},
                },
            )

        return JSONResponse(
            content={"token": token},
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/elevenlabs/conversation-signed-url")
    async def get_conversation_signed_url() -> JSONResponse:
        if not api_key or not agent_id:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "ELEVENLABS_AGENT_NOT_CONFIGURED",
                    "details": {"missing": ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID"]},
                },
            )

        params: dict[str, str] = {"agent_id": agent_id}
        if branch_id:
            params["branch_id"] = branch_id
        if environment:
            params["environment"] = environment

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(
                    f"{base_url.rstrip('/')}/v1/convai/conversation/get_signed_url",
                    headers={"xi-api-key": api_key},
                    params=params,
                )
        except httpx.HTTPError as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ELEVENLABS_UNAVAILABLE",
                    "details": {"message": str(exc)},
                },
            )

        if not res.is_success:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ELEVENLABS_SIGNED_URL_FAILED",
                    "details": {"status": res.status_code, "message": res.text[:500]},
                },
            )

        payload = res.json()
        signed_url = payload.get("signed_url")
        if not isinstance(signed_url, str) or not signed_url:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ELEVENLABS_SIGNED_URL_INVALID",
                    "details": {"message": "signed_url missing from upstream response"},
                },
            )

        return JSONResponse(
            content={"signedUrl": signed_url},
            headers={"Cache-Control": "no-store"},
        )

    app.add_api_route(
        "/v1/elevenlabs/conversation-token",
        get_conversation_token,
        methods=["GET"],
        dependencies=[Depends(require_subscription_access)],
    )
    app.add_api_route(
        "/v1/elevenlabs/conversation-signed-url",
        get_conversation_signed_url,
        methods=["GET"],
        dependencies=[Depends(require_subscription_access)],
    )
