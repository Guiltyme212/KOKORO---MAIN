from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    app_metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class AuthSession:
    access_token: str
    refresh_token: str
    expires_in: int
    user_id: str


@dataclass(frozen=True)
class CheckoutIdentity:
    checkout_session_id: str
    stripe_customer_id: str
    normalized_email: str


@dataclass(frozen=True)
class HandoffRecord:
    checkout_session_id: str
    stripe_customer_id: str
    normalized_email: str
    expires_at: datetime
    verify_attempts: int


@dataclass(frozen=True)
class AccessDecision:
    access: bool
    status: str
    access_until: datetime | None = None
    cancel_at_period_end: bool = False
    grace_until: datetime | None = None
    customer_ids: tuple[str, ...] = ()
