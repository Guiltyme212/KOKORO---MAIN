from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from kokoro_api.providers.blob.base import BlobStore

SIGNED_URL_EXPIRY_SEC = 60 * 60 * 24 * 30


@dataclass(slots=True)
class PersistInput:
    meditation_id: str
    audio_bytes: bytes
    mime_type: Literal["audio/mpeg"]
    meta: dict[str, object]


class PersistResult(BaseModel):
    audio_url: str
    latency_ms: int


async def persist(input: PersistInput, blob: BlobStore) -> PersistResult:
    t0 = time.monotonic()
    audio_key = f"meditations/{input.meditation_id}/audio.mp3"
    meta_key = f"meditations/{input.meditation_id}/meta.json"

    await blob.put(key=audio_key, body=input.audio_bytes, content_type=input.mime_type)
    await blob.put(
        key=meta_key,
        body=json.dumps(input.meta, indent=2),
        content_type="application/json",
    )

    audio_url = await blob.signed_url(audio_key, SIGNED_URL_EXPIRY_SEC)
    return PersistResult(
        audio_url=audio_url,
        latency_ms=int((time.monotonic() - t0) * 1000),
    )
