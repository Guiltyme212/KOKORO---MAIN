from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ErrorBody(BaseModel):
    error: Literal[
        "INVALID_INPUT",
        "AUDIO_GEN_FAILED",
        "UPSTREAM_RATE_LIMIT",
        "UPSTREAM_TIMEOUT",
        "INTERNAL",
    ]
    details: dict[str, object]
