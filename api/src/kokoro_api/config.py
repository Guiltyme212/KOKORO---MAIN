from __future__ import annotations

import sys
from typing import Literal

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = Field(default=8787, ge=1, le=65535)
    log_level: Literal["debug", "info", "warning", "error"] = "debug"

    # Which LLM produces the meditation script. Anthropic (via cli-proxy) or
    # OpenAI directly. Both keys are optional; the chosen one must be set.
    llm_provider: Literal["anthropic", "openai"] = "anthropic"

    anthropic_base_url: AnyHttpUrl | None = None
    anthropic_api_key: str | None = Field(default=None, min_length=20)
    anthropic_model: str = "claude-opus-4-7"

    openai_api_key: str | None = Field(default=None, min_length=20)
    openai_base_url: AnyHttpUrl = AnyHttpUrl("https://api.openai.com/v1")
    openai_model: str = "gpt-4o"

    whisper_api_key: str | None = Field(default=None, min_length=20)
    whisper_base_url: AnyHttpUrl = AnyHttpUrl("https://api.openai.com/v1")

    elevenlabs_api_key: str | None = Field(default=None, min_length=20)
    elevenlabs_base_url: AnyHttpUrl = AnyHttpUrl("https://api.elevenlabs.io")
    elevenlabs_model: str = "scribe_v2"
    elevenlabs_agent_id: str | None = None
    elevenlabs_branch_id: str | None = None
    elevenlabs_environment: str = "production"

    suno_base_url: AnyHttpUrl = AnyHttpUrl("https://api.sunoapi.org")
    suno_api_key: str = Field(min_length=20)
    suno_callback_url: AnyHttpUrl = AnyHttpUrl("https://example.com/suno-callback")

    blob_driver: Literal["filesystem", "s3"] = "filesystem"
    blob_fs_dir: str = "./blob-data"
    blob_s3_bucket: str | None = None
    blob_s3_endpoint: AnyHttpUrl | None = None
    blob_s3_access_key: str | None = None
    blob_s3_secret_key: str | None = None
    blob_public_base_url: AnyHttpUrl | None = None
    reference_public_base_url: AnyHttpUrl | None = None

    # Web/PWA identity and subscription access. These settings are optional so
    # legacy iOS and Telegram deployments can keep starting while staging is
    # being configured. Protected /v1 routes return 503 until all required
    # values are present.
    supabase_url: AnyHttpUrl | None = None
    supabase_publishable_key: str | None = None
    supabase_secret_key: str | None = None
    stripe_restricted_key: str | None = None
    stripe_api_base_url: AnyHttpUrl = AnyHttpUrl("https://api.stripe.com")
    stripe_allowed_product_ids: str = "prod_UfyAnM42JA5jub"
    auth_db_path: str | None = None
    purchase_url: AnyHttpUrl = AnyHttpUrl("https://kokoromind.com/funnel/standard/")
    manage_url: AnyHttpUrl = AnyHttpUrl("https://kokoromind.com/manage")

    cors_origin: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "capacitor://localhost,"
        "Kokoro://localhost,"
        "kokoro://localhost,"
        "https://app.kokoromind.com,"
        "https://kokoromind.com,"
        "https://www.kokoromind.com"
    )


def load_config() -> Config:
    try:
        return Config()  # type: ignore[call-arg]
    except Exception as e:
        sys.stderr.write(f"Invalid config: {e}\n")
        sys.exit(1)
