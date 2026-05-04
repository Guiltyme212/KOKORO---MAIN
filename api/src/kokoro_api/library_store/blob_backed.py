from __future__ import annotations

import json
from datetime import UTC, datetime

import structlog

from kokoro_api.library_store.base import LibraryStore, MeditationNotFoundError
from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.types import LibraryItem

log = structlog.get_logger()

SIGNED_URL_EXPIRY_SEC = 60 * 60 * 24 * 30


class BlobLibraryStore(LibraryStore):
    """Stores per-user library as a single JSON object at
    `users/{tg_user_id}/library.json` in the existing blob store."""

    name = "blob-backed"

    def __init__(self, blob: BlobStore) -> None:
        self._blob = blob

    @staticmethod
    def _user_key(tg_user_id: int) -> str:
        return f"users/{tg_user_id}/library.json"

    @staticmethod
    def _meta_key(meditation_id: str) -> str:
        return f"meditations/{meditation_id}/meta.json"

    @staticmethod
    def _audio_key(meditation_id: str) -> str:
        return f"meditations/{meditation_id}/audio.mp3"

    async def list_items(self, tg_user_id: int) -> list[LibraryItem]:
        return await self._read_and_resign(tg_user_id)

    async def add(self, tg_user_id: int, meditation_id: str) -> list[LibraryItem]:
        meta_bytes = await self._blob.get(self._meta_key(meditation_id))
        if meta_bytes is None:
            raise MeditationNotFoundError(
                f"meditation {meditation_id} has no meta.json in blob store"
            )

        try:
            meta = json.loads(meta_bytes.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise MeditationNotFoundError(
                f"meditation {meditation_id} meta.json is unreadable: {exc}"
            ) from exc

        new_item = self._build_item(meditation_id, meta)

        existing = await self._read_raw(tg_user_id)
        # Idempotent insert: if already present, just refresh the entry.
        existing = [it for it in existing if it["meditationId"] != meditation_id]
        existing.insert(0, new_item)
        await self._write_raw(tg_user_id, existing)
        return await self._resign(existing)

    async def remove(self, tg_user_id: int, meditation_id: str) -> list[LibraryItem]:
        existing = await self._read_raw(tg_user_id)
        filtered = [it for it in existing if it["meditationId"] != meditation_id]
        if len(filtered) != len(existing):
            await self._write_raw(tg_user_id, filtered)
        return await self._resign(filtered)

    async def _read_raw(self, tg_user_id: int) -> list[dict[str, object]]:
        raw = await self._blob.get(self._user_key(tg_user_id))
        if raw is None:
            return []
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            # Treat unreadable library as empty rather than blocking the user.
            return []
        if not isinstance(payload, dict):
            return []
        items = payload.get("items")
        if not isinstance(items, list):
            return []
        out: list[dict[str, object]] = []
        for entry in items:
            if isinstance(entry, dict):
                out.append(entry)
        return out

    async def _write_raw(self, tg_user_id: int, items: list[dict[str, object]]) -> None:
        body = json.dumps(
            {"tgUserId": tg_user_id, "items": items},
            ensure_ascii=False,
            indent=2,
        )
        await self._blob.put(
            key=self._user_key(tg_user_id),
            body=body,
            content_type="application/json",
        )

    async def _read_and_resign(self, tg_user_id: int) -> list[LibraryItem]:
        raw = await self._read_raw(tg_user_id)
        return await self._resign(raw)

    async def _resign(self, items: list[dict[str, object]]) -> list[LibraryItem]:
        out: list[LibraryItem] = []
        for raw in items:
            meditation_id = str(raw.get("meditationId", ""))
            if not meditation_id:
                continue
            audio_url = await self._blob.signed_url(
                self._audio_key(meditation_id), SIGNED_URL_EXPIRY_SEC
            )
            patched = {**raw, "audioUrl": audio_url}
            try:
                out.append(LibraryItem.model_validate(patched))
            except Exception as exc:
                # Corrupted entry — drop rather than crash the whole listing,
                # but log so we know it's happening (e.g. schema migration).
                log.warning(
                    "library_store.corrupt_item",
                    meditation_id=meditation_id,
                    error=str(exc),
                )
                continue
        return out

    @staticmethod
    def _build_item(meditation_id: str, meta: dict[str, object]) -> dict[str, object]:
        input_block = meta.get("input")
        if not isinstance(input_block, dict):
            input_block = {}

        capture = input_block.get("capture")
        capture_preview = BlobLibraryStore._capture_preview(capture)

        duration = meta.get("audioDurationSec") or meta.get("estimatedDurationSec") or 0
        try:
            duration_sec = float(duration)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            duration_sec = 0.0

        # The vibe lives at the top of meta (set by the orchestrator) and
        # also inside meta.input as a fallback for older saves.
        vibe = meta.get("vibe") or input_block.get("vibe") or "zen"

        return {
            "meditationId": meditation_id,
            # audioUrl is filled in at read time (re-signed on each list).
            "audioUrl": "",
            "durationSec": duration_sec,
            "callMe": str(input_block.get("callMe", "")),
            "realName": input_block.get("realName"),
            "vibe": str(vibe),
            "capturePreview": capture_preview,
            "savedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "generatedAt": str(meta.get("generatedAt", "")),
        }

    @staticmethod
    def _capture_preview(capture: object) -> str | None:
        if not isinstance(capture, dict):
            return None
        kind = capture.get("kind")
        if kind == "text":
            text = capture.get("text")
            if isinstance(text, str):
                return text[:120]
        elif kind == "theme":
            chips = capture.get("chips")
            if isinstance(chips, list):
                return ", ".join(str(c) for c in chips)[:120]
        elif kind == "voice":
            return "voice capture"
        return None
