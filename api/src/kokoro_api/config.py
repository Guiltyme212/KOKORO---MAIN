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

    cors_origin: str = "http://localhost:5173"


def load_config() -> Config:
    try:
        return Config()  # type: ignore[call-arg]
    except Exception as e:
        sys.stderr.write(f"Invalid config: {e}\n")
        sys.exit(1)
