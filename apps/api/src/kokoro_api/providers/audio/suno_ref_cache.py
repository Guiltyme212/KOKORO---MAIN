"""Disk-backed cache for sunoapi.org reference-track upload URLs.

Reference MP3s in `api/refs/` are static. Suno's file-stream-upload returns
a download URL that's reusable for ~3 days. We cache it locally so we only
pay the ~10-13s upload cost on the first request after a deploy (or after
TTL expiry), not on every meditation generation.

Storage: a single small JSON file in the blob-data dir.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

CACHE_FILENAME = "_suno_ref_cache.json"
DEFAULT_TTL_HOURS = 48

_lock = asyncio.Lock()


@dataclass(slots=True)
class _CacheEntry:
    upload_url: str
    uploaded_at: str
    expires_at: str


def _cache_path() -> Path:
    # Co-locate with the filesystem blob store so dev/prod both have a writable
    # spot without adding new config. The dir is ensured by main.py at startup.
    return Path("blob-data") / CACHE_FILENAME


def _load() -> dict[str, _CacheEntry]:
    path = _cache_path()
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    out: dict[str, _CacheEntry] = {}
    if not isinstance(raw, dict):
        return out
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        upload_url = value.get("upload_url")
        uploaded_at = value.get("uploaded_at")
        expires_at = value.get("expires_at")
        if not (isinstance(upload_url, str) and isinstance(uploaded_at, str)
                and isinstance(expires_at, str)):
            continue
        out[key] = _CacheEntry(
            upload_url=upload_url,
            uploaded_at=uploaded_at,
            expires_at=expires_at,
        )
    return out


def _dump(entries: dict[str, _CacheEntry]) -> None:
    path = _cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        key: {
            "upload_url": entry.upload_url,
            "uploaded_at": entry.uploaded_at,
            "expires_at": entry.expires_at,
        }
        for key, entry in entries.items()
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _now() -> datetime:
    return datetime.now(UTC)


def _key(local_path: Path) -> str:
    return str(local_path.resolve())


async def get_cached_url(local_path: Path) -> str | None:
    """Return a non-expired cached upload URL for the given local file, or None."""
    async with _lock:
        entries = _load()
        entry = entries.get(_key(local_path))
        if entry is None:
            return None
        try:
            expires = datetime.fromisoformat(entry.expires_at)
        except ValueError:
            return None
        if expires <= _now():
            return None
        return entry.upload_url


async def put_cached_url(
    local_path: Path,
    upload_url: str,
    ttl_hours: int = DEFAULT_TTL_HOURS,
) -> None:
    """Store a fresh upload URL for the given local file with a TTL window."""
    now = _now()
    entry = _CacheEntry(
        upload_url=upload_url,
        uploaded_at=now.isoformat(),
        expires_at=(now + timedelta(hours=ttl_hours)).isoformat(),
    )
    async with _lock:
        entries = _load()
        entries[_key(local_path)] = entry
        _dump(entries)
