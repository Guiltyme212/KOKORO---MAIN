from __future__ import annotations

from dataclasses import dataclass

from kokoro_api.auth.handoffs import HandoffStore
from kokoro_api.auth.stripe_access import AccessService, StripeReadClient
from kokoro_api.auth.supabase import SupabaseAuthClient, SupabaseJwtVerifier


@dataclass(frozen=True)
class AuthServices:
    jwt_verifier: SupabaseJwtVerifier
    supabase: SupabaseAuthClient
    stripe: StripeReadClient
    access: AccessService
    handoffs: HandoffStore
