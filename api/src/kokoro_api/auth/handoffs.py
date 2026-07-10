from __future__ import annotations

import asyncio
import hashlib
import secrets
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from kokoro_api.auth.models import CheckoutIdentity, HandoffRecord


class HandoffError(RuntimeError):
    pass


class HandoffNotFoundError(HandoffError):
    pass


class HandoffExpiredError(HandoffError):
    pass


class HandoffUsedError(HandoffError):
    pass


class HandoffAttemptsExceededError(HandoffError):
    pass


class HandoffRateLimitedError(HandoffError):
    pass


class HandoffResendCooldownError(HandoffError):
    pass


@dataclass(frozen=True)
class CreatedHandoff:
    token: str
    record: HandoffRecord


class HandoffStore:
    def __init__(self, path: str) -> None:
        self._path = Path(path)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize_sync)

    async def create(self, identity: CheckoutIdentity) -> CreatedHandoff:
        return await asyncio.to_thread(self._create_sync, identity)

    async def get_public(self, token: str) -> HandoffRecord:
        return await asyncio.to_thread(self._get_sync, token, False)

    async def begin_verify(self, token: str) -> HandoffRecord:
        return await asyncio.to_thread(self._get_sync, token, True)

    async def prepare_resend(self, token: str) -> HandoffRecord:
        return await asyncio.to_thread(self._prepare_resend_sync, token)

    async def mark_used(self, token: str) -> bool:
        return await asyncio.to_thread(self._mark_used_sync, token)

    async def cleanup_expired(self) -> int:
        return await asyncio.to_thread(self._cleanup_expired_sync)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=10.0)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize_sync(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS login_handoffs (
                    id TEXT PRIMARY KEY,
                    token_hash TEXT UNIQUE NOT NULL,
                    checkout_session_id TEXT NOT NULL,
                    stripe_customer_id TEXT NOT NULL,
                    normalized_email TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    otp_sent_at TEXT,
                    verify_attempts INTEGER NOT NULL DEFAULT 0,
                    used_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_handoffs_checkout "
                "ON login_handoffs(checkout_session_id, created_at)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_handoffs_expiry ON login_handoffs(expires_at)"
            )

    def _create_sync(self, identity: CheckoutIdentity) -> CreatedHandoff:
        now = datetime.now(UTC)
        cutoff = now - timedelta(days=1)
        expires = now + timedelta(minutes=15)
        token = secrets.token_urlsafe(32)
        token_hash = self._hash(token)
        handoff_id = str(uuid.uuid4())
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            # Keep expired rows for 24h so the per-Checkout-Session creation
            # limit cannot be bypassed simply by waiting out the 15m token TTL.
            connection.execute(
                "DELETE FROM login_handoffs WHERE created_at < ?", (cutoff.isoformat(),)
            )
            count = connection.execute(
                "SELECT COUNT(*) FROM login_handoffs "
                "WHERE checkout_session_id = ? AND created_at >= ?",
                (identity.checkout_session_id, cutoff.isoformat()),
            ).fetchone()[0]
            if int(count) >= 5:
                raise HandoffRateLimitedError("handoff creation limit reached")
            connection.execute(
                """
                INSERT INTO login_handoffs (
                    id, token_hash, checkout_session_id, stripe_customer_id,
                    normalized_email, expires_at, otp_sent_at, verify_attempts,
                    used_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
                """,
                (
                    handoff_id,
                    token_hash,
                    identity.checkout_session_id,
                    identity.stripe_customer_id,
                    identity.normalized_email,
                    expires.isoformat(),
                    now.isoformat(),
                    now.isoformat(),
                    now.isoformat(),
                ),
            )
        return CreatedHandoff(
            token=token,
            record=HandoffRecord(
                checkout_session_id=identity.checkout_session_id,
                stripe_customer_id=identity.stripe_customer_id,
                normalized_email=identity.normalized_email,
                expires_at=expires,
                verify_attempts=0,
            ),
        )

    def _get_sync(self, token: str, increment_attempt: bool) -> HandoffRecord:
        token_hash = self._hash(token)
        now = datetime.now(UTC)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM login_handoffs WHERE token_hash = ?", (token_hash,)
            ).fetchone()
            if row is None:
                raise HandoffNotFoundError("handoff not found")
            if row["used_at"] is not None:
                raise HandoffUsedError("handoff already used")
            expires_at = datetime.fromisoformat(str(row["expires_at"]))
            if expires_at <= now:
                raise HandoffExpiredError("handoff expired")
            attempts = int(row["verify_attempts"])
            if attempts >= 5:
                raise HandoffAttemptsExceededError("handoff verification limit reached")
            if increment_attempt:
                attempts += 1
                connection.execute(
                    "UPDATE login_handoffs SET verify_attempts = ?, updated_at = ? "
                    "WHERE token_hash = ?",
                    (attempts, now.isoformat(), token_hash),
                )
        return HandoffRecord(
            checkout_session_id=str(row["checkout_session_id"]),
            stripe_customer_id=str(row["stripe_customer_id"]),
            normalized_email=str(row["normalized_email"]),
            expires_at=expires_at,
            verify_attempts=attempts,
        )

    def _mark_used_sync(self, token: str) -> bool:
        now = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            cursor = connection.execute(
                "UPDATE login_handoffs SET used_at = ?, updated_at = ? "
                "WHERE token_hash = ? AND used_at IS NULL",
                (now, now, self._hash(token)),
            )
            return cursor.rowcount == 1

    def _prepare_resend_sync(self, token: str) -> HandoffRecord:
        token_hash = self._hash(token)
        now = datetime.now(UTC)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM login_handoffs WHERE token_hash = ?", (token_hash,)
            ).fetchone()
            if row is None:
                raise HandoffNotFoundError("handoff not found")
            if row["used_at"] is not None:
                raise HandoffUsedError("handoff already used")
            expires_at = datetime.fromisoformat(str(row["expires_at"]))
            if expires_at <= now:
                raise HandoffExpiredError("handoff expired")
            otp_sent_at = datetime.fromisoformat(str(row["otp_sent_at"]))
            if now - otp_sent_at < timedelta(seconds=60):
                raise HandoffResendCooldownError("handoff resend cooldown active")
            connection.execute(
                "UPDATE login_handoffs SET otp_sent_at = ?, updated_at = ? "
                "WHERE token_hash = ?",
                (now.isoformat(), now.isoformat(), token_hash),
            )
        return HandoffRecord(
            checkout_session_id=str(row["checkout_session_id"]),
            stripe_customer_id=str(row["stripe_customer_id"]),
            normalized_email=str(row["normalized_email"]),
            expires_at=expires_at,
            verify_attempts=int(row["verify_attempts"]),
        )

    def _cleanup_expired_sync(self) -> int:
        cutoff = datetime.now(UTC) - timedelta(days=1)
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM login_handoffs WHERE created_at < ?",
                (cutoff.isoformat(),),
            )
            return cursor.rowcount

    @staticmethod
    def _hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()
