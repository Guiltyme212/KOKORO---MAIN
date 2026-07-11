from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest

from kokoro_api.auth.models import CurrentUser
from kokoro_api.auth.stripe_access import (
    AccessService,
    StripeUnavailableError,
)


def _timestamp(value: datetime) -> int:
    return int(value.timestamp())


def _subscription(
    status: str,
    period_end: datetime,
    *,
    cancel_at_period_end: bool = False,
) -> dict[str, Any]:
    return {
        "status": status,
        "cancel_at_period_end": cancel_at_period_end,
        "items": {"data": [{"current_period_end": _timestamp(period_end)}]},
    }


def test_access_rules_cover_active_trial_cancel_and_past_due() -> None:
    now = datetime(2026, 7, 10, tzinfo=UTC)
    active = AccessService._evaluate_subscription(
        _subscription("active", now + timedelta(days=20), cancel_at_period_end=True),
        now=now,
    )
    assert active.access is True
    assert active.cancel_at_period_end is True

    trialing = AccessService._evaluate_subscription(
        _subscription("trialing", now + timedelta(days=7)), now=now
    )
    assert trialing.access is True

    within_grace = AccessService._evaluate_subscription(
        _subscription("past_due", now - timedelta(hours=47)), now=now
    )
    after_grace = AccessService._evaluate_subscription(
        _subscription("past_due", now - timedelta(hours=49)), now=now
    )
    assert within_grace.access is True
    assert within_grace.grace_until == now + timedelta(hours=1)
    assert after_grace.access is False

    for status in ("unpaid", "paused", "canceled", "incomplete", "incomplete_expired"):
        assert AccessService._evaluate_subscription(
            _subscription(status, now + timedelta(days=1)), now=now
        ).access is False


class _FakeStripe:
    def __init__(self, subscriptions: list[dict[str, Any]]) -> None:
        self.subscriptions = subscriptions
        self.calls = 0
        self.unavailable = False

    async def find_customer_ids_by_email(self, email: str) -> list[str]:
        _ = email
        if self.unavailable:
            raise StripeUnavailableError("offline")
        return ["cus_one", "cus_two"]

    async def subscriptions_for_customer(self, customer_id: str) -> list[dict[str, Any]]:
        _ = customer_id
        self.calls += 1
        if self.unavailable:
            raise StripeUnavailableError("offline")
        return self.subscriptions

    def subscription_is_kokoro(self, subscription: dict[str, Any]) -> bool:
        _ = subscription
        return True


class _FakeSupabase:
    def __init__(self) -> None:
        self.mapping: list[str] = []
        self.app_metadata: dict[str, object] = {}

    async def update_stripe_customer_ids(self, user_id: str, customer_ids: list[str]) -> None:
        _ = user_id
        self.mapping = customer_ids

    async def get_app_metadata(self, user_id: str) -> dict[str, object]:
        _ = user_id
        return self.app_metadata


@pytest.mark.asyncio
async def test_stale_jwt_falls_back_to_fresh_supabase_mapping() -> None:
    now = datetime.now(UTC)

    class _NoEmailMatchStripe(_FakeStripe):
        async def find_customer_ids_by_email(self, email: str) -> list[str]:
            _ = email
            return []

    stripe = _NoEmailMatchStripe([_subscription("active", now + timedelta(days=30))])
    supabase = _FakeSupabase()
    supabase.app_metadata = {"stripe_customer_ids": ["cus_fresh"]}
    service = AccessService(stripe=cast(Any, stripe), supabase=cast(Any, supabase))
    # JWT carries no mapping (it predates the verify-time metadata write) and
    # the email search finds nothing (e.g. Stripe stored a capitalized email).
    user = CurrentUser(id="user-stale-jwt", email="buyer@example.com")

    decision = await service.check(user)
    assert decision.access is True
    assert decision.customer_ids == ("cus_fresh",)


@pytest.mark.asyncio
async def test_access_service_caches_and_allows_any_matching_subscription() -> None:
    now = datetime.now(UTC)
    stripe = _FakeStripe(
        [
            _subscription("canceled", now - timedelta(days=1)),
            _subscription("active", now + timedelta(days=30)),
        ]
    )
    supabase = _FakeSupabase()
    service = AccessService(
        stripe=cast(Any, stripe),
        supabase=cast(Any, supabase),
    )
    user = CurrentUser(id="user-one", email="buyer@example.com")

    first = await service.check(user)
    second = await service.check(user)
    assert first.access is True
    assert second.access is True
    assert stripe.calls == 2  # two customers, only on the first access check
    assert supabase.mapping == ["cus_one", "cus_two"]


@pytest.mark.asyncio
async def test_stripe_outage_uses_only_recent_positive_cache() -> None:
    now = datetime.now(UTC)
    stripe = _FakeStripe([_subscription("active", now + timedelta(days=30))])
    service = AccessService(
        stripe=cast(Any, stripe),
        supabase=cast(Any, _FakeSupabase()),
    )
    user = CurrentUser(id="user-one", email="buyer@example.com")
    assert (await service.check(user)).access is True

    stripe.unavailable = True
    assert (await service.check(user, force_refresh=True)).access is True

    cold_service = AccessService(
        stripe=cast(Any, stripe),
        supabase=cast(Any, _FakeSupabase()),
    )
    with pytest.raises(StripeUnavailableError):
        await cold_service.check(user)


@pytest.mark.asyncio
async def test_stale_mapping_discovers_new_customer_purchase() -> None:
    now = datetime.now(UTC)

    class _MappedStripe(_FakeStripe):
        async def subscriptions_for_customer(self, customer_id: str) -> list[dict[str, Any]]:
            self.calls += 1
            if customer_id == "cus_old":
                return [_subscription("canceled", now - timedelta(days=1))]
            return [_subscription("active", now + timedelta(days=30))]

    stripe = _MappedStripe([])
    supabase = _FakeSupabase()
    service = AccessService(
        stripe=cast(Any, stripe),
        supabase=cast(Any, supabase),
    )
    user = CurrentUser(
        id="user-one",
        email="buyer@example.com",
        app_metadata={"stripe_customer_ids": ["cus_old"]},
    )

    decision = await service.check(user)
    assert decision.access is True
    assert decision.customer_ids == ("cus_old", "cus_one", "cus_two")
    assert supabase.mapping == ["cus_old", "cus_one", "cus_two"]
