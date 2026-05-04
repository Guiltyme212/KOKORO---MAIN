from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel


class PutResult(BaseModel):
    url: str
    latency_ms: int


class BlobStore(ABC):
    name: str

    @abstractmethod
    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult: ...

    @abstractmethod
    async def signed_url(self, key: str, expiry_sec: int) -> str: ...

    @abstractmethod
    async def get(self, key: str) -> bytes | None:
        """Return raw bytes for the key, or None if not found."""
