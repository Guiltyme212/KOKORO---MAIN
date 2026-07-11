from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import httpx

from kokoro_api.auth.models import AccessDecision, CheckoutIdentity, CurrentUser
from kokoro_api.auth.supabase import SupabaseAuthClient, SupabaseError


class StripeError(RuntimeError):
    pass


class StripeUnavailableError(StripeError):
    pass


class StripeCheckoutInvalidError(StripeError):
    pass


class StripeReadClient:
    def __init__(
        self,
        *,
        secret_key: str,
        allowed_product_ids: set[str],
        base_url: str = "https://api.stripe.com",
        timeout_sec: float = 15.0,
    ) -> None:
        self._secret_key = secret_key
        self._allowed_product_ids = allowed_product_ids
        self._base_url = base_url.rstrip("/")
        self._timeout_sec = timeout_sec

    async def checkout_identity(self, checkout_session_id: str) -> CheckoutIdentity:
        if not checkout_session_id.startswith("cs_"):
            raise StripeCheckoutInvalidError("invalid Checkout Session")
        session = await self._get(
            f"/v1/checkout/sessions/{quote(checkout_session_id, safe='')}",
            params=[("expand[]", "line_items.data.price.product")],
        )
        if session.get("status") != "complete" or session.get("mode") != "subscription":
            raise StripeCheckoutInvalidError(
                "Checkout Session is not a completed subscription"
            )

        customer_id = self._object_id(session.get("customer"))
        details = session.get("customer_details")
        email = details.get("email") if isinstance(details, dict) else None
        if not customer_id or not isinstance(email, str) or not email.strip():
            raise StripeCheckoutInvalidError("Checkout Session has no customer identity")
        if not self._contains_allowed_product(session.get("line_items")):
            raise StripeCheckoutInvalidError(
                "Checkout Session does not contain a Kokoro product"
            )
        return CheckoutIdentity(
            checkout_session_id=checkout_session_id,
            stripe_customer_id=customer_id,
            normalized_email=email.strip().lower(),
        )

    async def find_customer_ids_by_email(self, normalized_email: str) -> list[str]:
        found: list[str] = []
        starting_after: str | None = None
        while True:
            params: list[tuple[str, str]] = [
                ("email", normalized_email),
                ("limit", "100"),
            ]
            if starting_after:
                params.append(("starting_after", starting_after))
            payload = await self._get("/v1/customers", params=params)
            data = payload.get("data")
            rows = data if isinstance(data, list) else []
            for customer in rows:
                if not isinstance(customer, dict):
                    continue
                customer_email = customer.get("email")
                customer_id = customer.get("id")
                if (
                    isinstance(customer_email, str)
                    and customer_email.strip().lower() == normalized_email
                    and isinstance(customer_id, str)
                ):
                    found.append(customer_id)
            if not payload.get("has_more") or not rows:
                break
            last = rows[-1]
            starting_after = last.get("id") if isinstance(last, dict) else None
            if not isinstance(starting_after, str):
                break
        # The list filter above matches email case-sensitively, but checkout
        # emails routinely arrive with mobile-keyboard capitalization
        # ("DimaCyb@…"). The Search API matches case-insensitively (with up to
        # ~1 min indexing lag), so merge its hits as a second pass.
        escaped = normalized_email.replace("\\", "\\\\").replace('"', '\\"')
        payload = await self._get(
            "/v1/customers/search",
            params=[("query", f'email:"{escaped}"'), ("limit", "100")],
        )
        data = payload.get("data")
        for customer in data if isinstance(data, list) else []:
            if not isinstance(customer, dict):
                continue
            customer_email = customer.get("email")
            customer_id = customer.get("id")
            if (
                isinstance(customer_email, str)
                and customer_email.strip().lower() == normalized_email
                and isinstance(customer_id, str)
            ):
                found.append(customer_id)
        return sorted(set(found))

    async def subscriptions_for_customer(self, customer_id: str) -> list[dict[str, Any]]:
        subscriptions: list[dict[str, Any]] = []
        starting_after: str | None = None
        while True:
            params: list[tuple[str, str]] = [
                ("customer", customer_id),
                ("status", "all"),
                ("limit", "100"),
            ]
            if starting_after:
                params.append(("starting_after", starting_after))
            payload = await self._get("/v1/subscriptions", params=params)
            data = payload.get("data")
            rows = data if isinstance(data, list) else []
            subscriptions.extend(row for row in rows if isinstance(row, dict))
            if not payload.get("has_more") or not rows:
                break
            last = rows[-1]
            starting_after = last.get("id") if isinstance(last, dict) else None
            if not isinstance(starting_after, str):
                break
        return subscriptions

    def subscription_is_kokoro(self, subscription: dict[str, Any]) -> bool:
        return self._contains_allowed_product(subscription.get("items"))

    async def _get(
        self,
        path: str,
        *,
        params: list[tuple[str, str]] | None = None,
    ) -> dict[str, Any]:
        query_items: list[tuple[str, str | int | float | bool | None]] = []
        if params:
            query_items.extend(params)
        try:
            async with httpx.AsyncClient(timeout=self._timeout_sec) as client:
                response = await client.get(
                    f"{self._base_url}{path}",
                    auth=(self._secret_key, ""),
                    params=httpx.QueryParams(query_items),
                )
        except httpx.HTTPError as exc:
            raise StripeUnavailableError("Stripe is unavailable") from exc
        if response.status_code >= 500 or response.status_code == 429:
            raise StripeUnavailableError("Stripe is temporarily unavailable")
        if response.status_code >= 400:
            raise StripeError(f"Stripe request failed with {response.status_code}")
        payload = response.json()
        if not isinstance(payload, dict):
            raise StripeUnavailableError("Stripe returned an invalid response")
        return payload

    def _contains_allowed_product(self, line_items: object) -> bool:
        if not self._allowed_product_ids:
            return True
        block = line_items if isinstance(line_items, dict) else {}
        data = block.get("data")
        rows = data if isinstance(data, list) else []
        for item in rows:
            if not isinstance(item, dict):
                continue
            price = item.get("price")
            if not isinstance(price, dict):
                continue
            product_id = self._object_id(price.get("product"))
            if product_id in self._allowed_product_ids:
                return True
        return False

    @staticmethod
    def _object_id(value: object) -> str | None:
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            object_id = value.get("id")
            return object_id if isinstance(object_id, str) else None
        return None


@dataclass(frozen=True)
class _CacheEntry:
    decision: AccessDecision
    checked_at: datetime


class AccessService:
    def __init__(self, *, stripe: StripeReadClient, supabase: SupabaseAuthClient) -> None:
        self._stripe = stripe
        self._supabase = supabase
        self._cache: dict[str, _CacheEntry] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def check(self, user: CurrentUser, *, force_refresh: bool = False) -> AccessDecision:
        now = datetime.now(UTC)
        cached = self._cache.get(user.id)
        if not force_refresh and cached and now - cached.checked_at < timedelta(seconds=60):
            return cached.decision

        lock = self._locks.setdefault(user.id, asyncio.Lock())
        async with lock:
            now = datetime.now(UTC)
            cached = self._cache.get(user.id)
            if not force_refresh and cached and now - cached.checked_at < timedelta(seconds=60):
                return cached.decision
            try:
                decision = await self._check_uncached(user, now=now)
            except StripeUnavailableError:
                if (
                    cached
                    and cached.decision.access
                    and now - cached.checked_at <= timedelta(minutes=10)
                ):
                    return cached.decision
                raise
            self._cache[user.id] = _CacheEntry(decision=decision, checked_at=now)
            return decision

    def evict(self, user_id: str) -> None:
        self._cache.pop(user_id, None)

    async def _check_uncached(self, user: CurrentUser, *, now: datetime) -> AccessDecision:
        mapped_customer_ids = self._metadata_customer_ids(user.app_metadata)
        customer_ids = list(mapped_customer_ids)
        if not customer_ids:
            customer_ids = await self._stripe.find_customer_ids_by_email(user.email)
            if customer_ids:
                await self._save_mapping_best_effort(user.id, customer_ids)
        if not customer_ids:
            # The verify-time mapping may already exist in Supabase while the
            # caller's JWT predates it — claims only refresh with the token.
            customer_ids = await self._fresh_metadata_customer_ids(user.id)

        subscriptions: list[dict[str, Any]] = []
        for customer_id in customer_ids:
            subscriptions.extend(await self._stripe.subscriptions_for_customer(customer_id))

        decisions = self._evaluate_subscriptions(subscriptions, now=now)
        # A returning customer may purchase again under a new Stripe Customer.
        # If the optimized mapping has no current access, refresh the exact-email
        # customer set so `Refresh access` can discover that new purchase.
        if mapped_customer_ids and not any(decision.access for decision in decisions):
            discovered_ids = await self._stripe.find_customer_ids_by_email(user.email)
            missing_ids = sorted(set(discovered_ids) - set(customer_ids))
            for customer_id in missing_ids:
                subscriptions.extend(await self._stripe.subscriptions_for_customer(customer_id))
            if missing_ids:
                customer_ids = sorted(set(customer_ids) | set(discovered_ids))
                await self._save_mapping_best_effort(user.id, customer_ids)
                decisions = self._evaluate_subscriptions(subscriptions, now=now)

        allowed = [decision for decision in decisions if decision.access]
        if allowed:
            selected = max(allowed, key=self._decision_rank)
            return AccessDecision(
                access=True,
                status=selected.status,
                access_until=selected.access_until,
                cancel_at_period_end=selected.cancel_at_period_end,
                grace_until=selected.grace_until,
                customer_ids=tuple(customer_ids),
            )
        denied_status = decisions[0].status if decisions else "none"
        return AccessDecision(
            access=False,
            status=denied_status,
            customer_ids=tuple(customer_ids),
        )

    async def _save_mapping_best_effort(self, user_id: str, customer_ids: list[str]) -> None:
        try:
            await self._supabase.update_stripe_customer_ids(user_id, customer_ids)
        except SupabaseError:
            # Mapping is only an optimization. Stripe remains the source of
            # truth, so an admin-metadata write failure must not deny access.
            pass

    async def _fresh_metadata_customer_ids(self, user_id: str) -> list[str]:
        try:
            metadata = await self._supabase.get_app_metadata(user_id)
        except SupabaseError:
            return []
        return self._metadata_customer_ids(metadata)

    def _evaluate_subscriptions(
        self,
        subscriptions: list[dict[str, Any]],
        *,
        now: datetime,
    ) -> list[AccessDecision]:
        return [
            self._evaluate_subscription(subscription, now=now)
            for subscription in subscriptions
            if self._stripe.subscription_is_kokoro(subscription)
        ]

    @staticmethod
    def _metadata_customer_ids(metadata: dict[str, object]) -> list[str]:
        raw = metadata.get("stripe_customer_ids")
        if not isinstance(raw, list):
            return []
        return sorted({item for item in raw if isinstance(item, str) and item.startswith("cus_")})

    @staticmethod
    def _evaluate_subscription(
        subscription: dict[str, Any], *, now: datetime
    ) -> AccessDecision:
        status_raw = subscription.get("status")
        status = status_raw if isinstance(status_raw, str) else "none"
        cancel_at_period_end = bool(subscription.get("cancel_at_period_end", False))
        period_end = AccessService._subscription_period_end(subscription)

        if status in {"active", "trialing"}:
            return AccessDecision(
                access=True,
                status=status,
                access_until=period_end,
                cancel_at_period_end=cancel_at_period_end,
            )
        if status == "past_due" and period_end is not None:
            grace_until = period_end + timedelta(hours=48)
            return AccessDecision(
                access=now <= grace_until,
                status=status,
                access_until=period_end,
                cancel_at_period_end=cancel_at_period_end,
                grace_until=grace_until,
            )
        return AccessDecision(access=False, status=status)

    @staticmethod
    def _subscription_period_end(subscription: dict[str, Any]) -> datetime | None:
        timestamps: list[int] = []
        top_level = subscription.get("current_period_end")
        if isinstance(top_level, int):
            timestamps.append(top_level)
        trial_end = subscription.get("trial_end")
        if isinstance(trial_end, int):
            timestamps.append(trial_end)
        items = subscription.get("items")
        item_rows = items.get("data") if isinstance(items, dict) else None
        if isinstance(item_rows, list):
            for item in item_rows:
                if not isinstance(item, dict):
                    continue
                item_end = item.get("current_period_end")
                if isinstance(item_end, int):
                    timestamps.append(item_end)
        if not timestamps:
            return None
        return datetime.fromtimestamp(max(timestamps), tz=UTC)

    @staticmethod
    def _decision_rank(decision: AccessDecision) -> tuple[int, float]:
        status_rank = {"active": 3, "trialing": 2, "past_due": 1}.get(decision.status, 0)
        until = decision.grace_until or decision.access_until
        return status_rank, until.timestamp() if until else float("inf")
