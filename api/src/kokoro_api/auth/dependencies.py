from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from kokoro_api.auth.models import CurrentUser
from kokoro_api.auth.services import AuthServices
from kokoro_api.auth.stripe_access import StripeUnavailableError
from kokoro_api.auth.supabase import SupabaseError


async def require_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    services: AuthServices | None = getattr(request.app.state, "auth_services", None)
    if services is None:
        raise HTTPException(
            status_code=503,
            detail={"error": "AUTH_NOT_CONFIGURED"},
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "AUTH_REQUIRED"})
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail={"error": "AUTH_REQUIRED"})
    try:
        user = await services.jwt_verifier.verify(token)
    except SupabaseError as exc:
        raise HTTPException(status_code=401, detail={"error": "INVALID_SESSION"}) from exc
    request.state.current_user = user
    return user


async def require_subscription_access(
    request: Request,
    user: Annotated[CurrentUser, Depends(require_current_user)],
) -> CurrentUser:
    services = request.app.state.auth_services
    try:
        decision = await services.access.check(user)
    except StripeUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "ACCESS_CHECK_UNAVAILABLE"},
        ) from exc
    if not decision.access:
        raise HTTPException(
            status_code=402,
            detail={"error": "SUBSCRIPTION_REQUIRED", "status": decision.status},
        )
    request.state.access_decision = decision
    return user
