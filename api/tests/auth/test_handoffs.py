from __future__ import annotations

from pathlib import Path

import pytest

from kokoro_api.auth.handoffs import (
    HandoffAttemptsExceededError,
    HandoffRateLimitedError,
    HandoffResendCooldownError,
    HandoffStore,
    HandoffUsedError,
)
from kokoro_api.auth.models import CheckoutIdentity


def _identity(session_id: str = "cs_test_one") -> CheckoutIdentity:
    return CheckoutIdentity(
        checkout_session_id=session_id,
        stripe_customer_id="cus_test_one",
        normalized_email="buyer@example.com",
    )


@pytest.mark.asyncio
async def test_handoff_stores_only_token_hash_and_is_one_time(tmp_path: Path) -> None:
    db_path = tmp_path / "auth.sqlite3"
    store = HandoffStore(str(db_path))
    await store.initialize()

    created = await store.create(_identity())
    assert created.token.encode() not in db_path.read_bytes()
    assert (await store.get_public(created.token)).normalized_email == "buyer@example.com"
    assert await store.mark_used(created.token) is True
    assert await store.mark_used(created.token) is False
    with pytest.raises(HandoffUsedError):
        await store.get_public(created.token)


@pytest.mark.asyncio
async def test_handoff_limits_creations_per_checkout_session(tmp_path: Path) -> None:
    store = HandoffStore(str(tmp_path / "auth.sqlite3"))
    await store.initialize()
    for _ in range(5):
        await store.create(_identity())
    with pytest.raises(HandoffRateLimitedError):
        await store.create(_identity())


@pytest.mark.asyncio
async def test_handoff_limits_verification_attempts(tmp_path: Path) -> None:
    store = HandoffStore(str(tmp_path / "auth.sqlite3"))
    await store.initialize()
    created = await store.create(_identity())
    for expected in range(1, 6):
        record = await store.begin_verify(created.token)
        assert record.verify_attempts == expected
    with pytest.raises(HandoffAttemptsExceededError):
        await store.begin_verify(created.token)


@pytest.mark.asyncio
async def test_handoff_enforces_resend_cooldown(tmp_path: Path) -> None:
    store = HandoffStore(str(tmp_path / "auth.sqlite3"))
    await store.initialize()
    created = await store.create(_identity())
    with pytest.raises(HandoffResendCooldownError):
        await store.prepare_resend(created.token)
