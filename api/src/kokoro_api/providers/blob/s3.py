from __future__ import annotations

from kokoro_api.providers.blob.base import BlobStore, PutResult


class S3BlobStore(BlobStore):
    name = "s3"

    def __init__(
        self,
        *,
        bucket: str,
        endpoint: str,
        access_key: str,
        secret_key: str,
        public_base_url: str,
    ) -> None:
        self._bucket = bucket
        self._endpoint = endpoint
        self._access = access_key
        self._secret = secret_key
        self._public = public_base_url

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        _ = (key, body, content_type)
        raise NotImplementedError("S3BlobStore not yet implemented; use filesystem in dev")

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        _ = (key, expiry_sec)
        raise NotImplementedError("S3BlobStore not yet implemented")
