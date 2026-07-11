from __future__ import annotations

import asyncio
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from kokoro_api.auth.models import AuthSession, CurrentUser


class SupabaseError(RuntimeError):
    pass


class SupabaseOtpError(SupabaseError):
    pass


class SupabaseJwtVerifier:
    def __init__(self, *, url: str) -> None:
        self._url = url.rstrip("/")
        self._issuer = f"{self._url}/auth/v1"
        self._jwks = PyJWKClient(f"{self._url}/auth/v1/.well-known/jwks.json", cache_keys=True)

    async def verify(self, token: str) -> CurrentUser:
        try:
            signing_key = await asyncio.to_thread(self._jwks.get_signing_key_from_jwt, token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
                issuer=self._issuer,
                options={"require": ["exp", "sub"]},
            )
        except jwt.PyJWTError as exc:
            raise SupabaseError("invalid Supabase access token") from exc

        subject = payload.get("sub")
        email = payload.get("email")
        metadata = payload.get("app_metadata")
        if not isinstance(subject, str) or not subject:
            raise SupabaseError("Supabase access token has no subject")
        if not isinstance(email, str) or not email.strip():
            raise SupabaseError("Supabase access token has no verified email")
        if not isinstance(metadata, dict):
            metadata = {}
        return CurrentUser(
            id=subject,
            email=email.strip().lower(),
            app_metadata={str(key): value for key, value in metadata.items()},
        )


class SupabaseAuthClient:
    def __init__(
        self,
        *,
        url: str,
        publishable_key: str,
        secret_key: str,
        timeout_sec: float = 15.0,
    ) -> None:
        self._url = url.rstrip("/")
        self._publishable_key = publishable_key
        self._secret_key = secret_key
        self._timeout_sec = timeout_sec

    @property
    def public_headers(self) -> dict[str, str]:
        return {
            "apikey": self._publishable_key,
            "Authorization": f"Bearer {self._publishable_key}",
            "Content-Type": "application/json",
        }

    @property
    def admin_headers(self) -> dict[str, str]:
        return {
            "apikey": self._secret_key,
            "Authorization": f"Bearer {self._secret_key}",
            "Content-Type": "application/json",
        }

    async def send_otp(self, email: str, *, captcha_token: str | None = None) -> None:
        body: dict[str, object] = {
            "email": email,
            "create_user": True,
        }
        if captcha_token:
            body["gotrue_meta_security"] = {"captcha_token": captcha_token}
        async with httpx.AsyncClient(timeout=self._timeout_sec) as client:
            try:
                response = await client.post(
                    f"{self._url}/auth/v1/otp",
                    headers=self.public_headers,
                    json=body,
                )
            except httpx.HTTPError as exc:
                raise SupabaseError("Supabase Auth is unavailable") from exc
        if response.status_code >= 400:
            raise SupabaseOtpError(self._neutral_otp_error(response))

    async def verify_otp(self, email: str, token: str) -> AuthSession:
        async with httpx.AsyncClient(timeout=self._timeout_sec) as client:
            try:
                response = await client.post(
                    f"{self._url}/auth/v1/verify",
                    headers=self.public_headers,
                    json={"email": email, "token": token, "type": "email"},
                )
            except httpx.HTTPError as exc:
                raise SupabaseError("Supabase Auth is unavailable") from exc
        if response.status_code >= 400:
            raise SupabaseOtpError(self._neutral_otp_error(response))

        payload = response.json()
        user = payload.get("user")
        user_id = user.get("id") if isinstance(user, dict) else None
        access_token = payload.get("access_token")
        refresh_token = payload.get("refresh_token")
        expires_in = payload.get("expires_in", 3600)
        if not (
            isinstance(user_id, str)
            and isinstance(access_token, str)
            and isinstance(refresh_token, str)
            and isinstance(expires_in, int)
        ):
            raise SupabaseError("Supabase returned an invalid session")
        return AuthSession(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            user_id=user_id,
        )

    async def update_stripe_customer_ids(self, user_id: str, customer_ids: list[str]) -> None:
        metadata = await self._get_app_metadata(user_id)
        metadata["stripe_customer_ids"] = sorted(set(customer_ids))
        await self._admin_request(
            "PUT",
            f"/auth/v1/admin/users/{user_id}",
            json={"app_metadata": metadata},
        )

    async def delete_user(self, user_id: str) -> None:
        await self._admin_request("DELETE", f"/auth/v1/admin/users/{user_id}")

    async def get_app_metadata(self, user_id: str) -> dict[str, object]:
        return await self._get_app_metadata(user_id)

    async def _get_app_metadata(self, user_id: str) -> dict[str, object]:
        payload = await self._admin_request("GET", f"/auth/v1/admin/users/{user_id}")
        metadata = payload.get("app_metadata")
        if not isinstance(metadata, dict):
            return {}
        return {str(key): value for key, value in metadata.items()}

    async def _admin_request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, object] | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout_sec) as client:
            try:
                response = await client.request(
                    method,
                    f"{self._url}{path}",
                    headers=self.admin_headers,
                    json=json,
                )
            except httpx.HTTPError as exc:
                raise SupabaseError("Supabase Admin API is unavailable") from exc
        if response.status_code >= 400:
            raise SupabaseError(f"Supabase Admin API failed with {response.status_code}")
        if response.status_code == 204 or not response.content:
            return {}
        payload = response.json()
        return payload if isinstance(payload, dict) else {}

    @staticmethod
    def _neutral_otp_error(response: httpx.Response) -> str:
        if response.status_code == 429:
            return "Please wait before requesting or checking another code."
        return "The code could not be sent or verified. Please try again."
