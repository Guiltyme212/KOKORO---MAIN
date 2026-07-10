from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import Field

from kokoro_api.auth.dependencies import require_current_user
from kokoro_api.auth.handoffs import (
    HandoffAttemptsExceededError,
    HandoffError,
    HandoffExpiredError,
    HandoffNotFoundError,
    HandoffRateLimitedError,
    HandoffResendCooldownError,
    HandoffUsedError,
)
from kokoro_api.auth.models import AccessDecision, CurrentUser, HandoffRecord
from kokoro_api.auth.services import AuthServices
from kokoro_api.auth.stripe_access import (
    StripeCheckoutInvalidError,
    StripeError,
    StripeUnavailableError,
)
from kokoro_api.auth.supabase import SupabaseError, SupabaseOtpError
from kokoro_api.types import _CamelModel


class HandoffCreateInput(_CamelModel):
    checkout_session_id: Annotated[str, Field(min_length=4, max_length=255)]


class HandoffInfoInput(_CamelModel):
    handoff_token: Annotated[str, Field(min_length=32, max_length=255)]


class HandoffVerifyInput(HandoffInfoInput):
    otp: Annotated[str, Field(pattern=r"^\d{6}$")]


def register_auth_access_routes(
    app: FastAPI,
    *,
    purchase_url: str,
    manage_url: str,
    delete_user_data: Callable[[str], Awaitable[None]],
) -> None:
    @app.post("/v1/auth/handoffs")
    async def create_handoff(input: HandoffCreateInput, request: Request) -> JSONResponse:
        services = _services(request)
        try:
            identity = await services.stripe.checkout_identity(input.checkout_session_id)
            created = await services.handoffs.create(identity)
            await services.supabase.send_otp(identity.normalized_email)
        except HandoffRateLimitedError as exc:
            raise HTTPException(
                status_code=429, detail={"error": "HANDOFF_RATE_LIMITED"}
            ) from exc
        except StripeCheckoutInvalidError as exc:
            raise HTTPException(
                status_code=400, detail={"error": "CHECKOUT_SESSION_INVALID"}
            ) from exc
        except StripeUnavailableError as exc:
            raise HTTPException(
                status_code=503, detail={"error": "CHECKOUT_LOOKUP_UNAVAILABLE"}
            ) from exc
        except StripeError as exc:
            raise HTTPException(
                status_code=400, detail={"error": "CHECKOUT_SESSION_INVALID"}
            ) from exc
        except SupabaseOtpError as exc:
            raise HTTPException(status_code=429, detail={"error": "OTP_NOT_SENT"}) from exc
        except SupabaseError as exc:
            raise HTTPException(status_code=503, detail={"error": "AUTH_UNAVAILABLE"}) from exc

        return JSONResponse(
            content={
                "handoffToken": created.token,
                "maskedEmail": _mask_email(identity.normalized_email),
                "expiresAt": _iso(created.record.expires_at),
            },
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/v1/auth/handoffs/info")
    async def handoff_info(input: HandoffInfoInput, request: Request) -> JSONResponse:
        services = _services(request)
        try:
            record = await services.handoffs.get_public(input.handoff_token)
        except HandoffError as exc:
            raise _handoff_http_error(exc) from exc
        return JSONResponse(
            content=_handoff_public(record),
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/v1/auth/handoffs/verify")
    async def verify_handoff(input: HandoffVerifyInput, request: Request) -> JSONResponse:
        services = _services(request)
        try:
            record = await services.handoffs.begin_verify(input.handoff_token)
            session = await services.supabase.verify_otp(record.normalized_email, input.otp)
            try:
                await services.supabase.update_stripe_customer_ids(
                    session.user_id, [record.stripe_customer_id]
                )
            except SupabaseError:
                # Mapping is an optimization; verified email lookup still grants
                # the correct Stripe access if this best-effort write fails.
                pass
            if not await services.handoffs.mark_used(input.handoff_token):
                raise HandoffUsedError("handoff already used")
        except HandoffError as exc:
            raise _handoff_http_error(exc) from exc
        except SupabaseOtpError as exc:
            raise HTTPException(status_code=400, detail={"error": "OTP_INVALID"}) from exc
        except SupabaseError as exc:
            raise HTTPException(status_code=503, detail={"error": "AUTH_UNAVAILABLE"}) from exc

        return JSONResponse(
            content={
                "accessToken": session.access_token,
                "refreshToken": session.refresh_token,
                "expiresIn": session.expires_in,
            },
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/v1/auth/handoffs/resend", status_code=204)
    async def resend_handoff(
        input: HandoffInfoInput,
        request: Request,
        response: Response,
    ) -> None:
        services = _services(request)
        response.headers["Cache-Control"] = "no-store"
        try:
            record = await services.handoffs.prepare_resend(input.handoff_token)
            await services.supabase.send_otp(record.normalized_email)
        except HandoffError as exc:
            raise _handoff_http_error(exc) from exc
        except SupabaseOtpError as exc:
            raise HTTPException(status_code=429, detail={"error": "OTP_NOT_SENT"}) from exc
        except SupabaseError as exc:
            raise HTTPException(status_code=503, detail={"error": "AUTH_UNAVAILABLE"}) from exc

    @app.get("/v1/access")
    async def get_access(
        request: Request,
        user: Annotated[CurrentUser, Depends(require_current_user)],
        refresh: bool = Query(default=False),
    ) -> JSONResponse:
        services = _services(request)
        try:
            decision = await services.access.check(user, force_refresh=refresh)
        except StripeUnavailableError as exc:
            raise HTTPException(
                status_code=503, detail={"error": "ACCESS_CHECK_UNAVAILABLE"}
            ) from exc
        return JSONResponse(
            content=_access_payload(decision, purchase_url, manage_url),
            headers={"Cache-Control": "no-store"},
        )

    @app.delete("/v1/account", status_code=204)
    async def delete_account(
        request: Request,
        user: Annotated[CurrentUser, Depends(require_current_user)],
    ) -> None:
        services = _services(request)
        try:
            await delete_user_data(user.id)
            await services.supabase.delete_user(user.id)
        except SupabaseError as exc:
            raise HTTPException(status_code=503, detail={"error": "AUTH_UNAVAILABLE"}) from exc
        services.access.evict(user.id)


def _services(request: Request) -> AuthServices:
    services: AuthServices | None = getattr(request.app.state, "auth_services", None)
    if services is None:
        raise HTTPException(status_code=503, detail={"error": "AUTH_NOT_CONFIGURED"})
    return services


def _handoff_http_error(exc: HandoffError) -> HTTPException:
    if isinstance(exc, HandoffNotFoundError):
        return HTTPException(status_code=404, detail={"error": "HANDOFF_NOT_FOUND"})
    if isinstance(exc, HandoffExpiredError):
        return HTTPException(status_code=410, detail={"error": "HANDOFF_EXPIRED"})
    if isinstance(exc, HandoffUsedError):
        return HTTPException(status_code=409, detail={"error": "HANDOFF_USED"})
    if isinstance(exc, HandoffAttemptsExceededError):
        return HTTPException(status_code=429, detail={"error": "HANDOFF_ATTEMPTS_EXCEEDED"})
    if isinstance(exc, HandoffResendCooldownError):
        return HTTPException(status_code=429, detail={"error": "OTP_RESEND_COOLDOWN"})
    return HTTPException(status_code=400, detail={"error": "HANDOFF_INVALID"})


def _handoff_public(record: HandoffRecord) -> dict[str, object]:
    return {
        "maskedEmail": _mask_email(record.normalized_email),
        "expiresAt": _iso(record.expires_at),
    }


def _access_payload(
    decision: AccessDecision,
    purchase_url: str,
    manage_url: str,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "access": decision.access,
        "status": decision.status,
        "accessUntil": _iso(decision.access_until) if decision.access_until else None,
        "cancelAtPeriodEnd": decision.cancel_at_period_end,
        "graceUntil": _iso(decision.grace_until) if decision.grace_until else None,
        "manageUrl": manage_url,
    }
    if not decision.access:
        payload["purchaseUrl"] = purchase_url
    return payload


def _mask_email(email: str) -> str:
    local, separator, domain = email.partition("@")
    if not separator:
        return "***"
    visible = local[:1] if local else ""
    return f"{visible}***@{domain}"


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
