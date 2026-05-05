from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import httpx
import structlog

from kokoro_api.providers.audio.base import (
    AudioResult,
    MeditationAudioProvider,
    StreamReady,
    SynthesizeEvent,
)
from kokoro_api.providers.audio.suno_ref_cache import get_cached_url, put_cached_url
from kokoro_api.types import Locale

log = structlog.get_logger()

POLL_INTERVAL_SEC = 4
# Suno V5 + upload-cover routinely takes 90-180s but tail latency can exceed
# 4 minutes for longer scripts. Railway's edge proxy gives ~5 min before
# returning 504, so cap below that.
POLL_TIMEOUT_SEC = 270
ACEDATA_MODEL = "chirp-v5"
SUNOAPI_MODEL = "V5"
SUNOAPI_FILE_BASE_URL = "https://sunoapiorg.redpandaai.co"
FAILED_STATUSES = {
    "create_task_failed",
    "generate_audio_failed",
    "callback_exception",
    "sensitive_word_error",
    "failed",
    "error",
}


class SunoAudioProvider(MeditationAudioProvider):
    name: str

    def __init__(self, *, base_url: str, api_key: str, callback_url: str | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._callback_url = callback_url or "https://example.com/suno-callback"
        self._uses_sunoapi_org = "sunoapi.org" in self._base_url
        self.name = "sunoapi-org" if self._uses_sunoapi_org else "suno-acedata"

    async def synthesize(
        self,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Locale,
        candidates: int,
    ) -> AudioResult:
        if self._uses_sunoapi_org:
            return await self._synthesize_sunoapi_org(
                script=script,
                voice_persona_id=voice_persona_id,
                music_style_prompt=music_style_prompt,
                reference_track_urls=reference_track_urls,
                target_duration_sec=target_duration_sec,
                locale=locale,
            )

        return await self._synthesize_acedata(
            script=script,
            voice_persona_id=voice_persona_id,
            music_style_prompt=music_style_prompt,
            reference_track_urls=reference_track_urls,
            target_duration_sec=target_duration_sec,
            locale=locale,
            candidates=candidates,
        )

    async def synthesize_streaming(
        self,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Locale,
        candidates: int,
    ) -> AsyncIterator[SynthesizeEvent]:
        """Yield ('stream', StreamReady) as soon as a playable streamAudioUrl
        appears, then ('final', AudioResult) once the mastered audio is ready.
        sunoapi.org only — acedata path falls through to one 'final' yield."""
        if not self._uses_sunoapi_org:
            result = await self._synthesize_acedata(
                script=script,
                voice_persona_id=voice_persona_id,
                music_style_prompt=music_style_prompt,
                reference_track_urls=reference_track_urls,
                target_duration_sec=target_duration_sec,
                locale=locale,
                candidates=candidates,
            )
            yield ("final", result)
            return

        _ = locale
        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=POLL_TIMEOUT_SEC + 30) as client:
            if reference_track_urls:
                upload_url = await self._prepare_reference_upload_url(
                    client,
                    reference_track_urls[0],
                )
                task_id = await self._start_sunoapi_org_upload_cover_job(
                    client,
                    upload_url=upload_url,
                    script=script,
                    voice_persona_id=voice_persona_id,
                    music_style_prompt=music_style_prompt,
                )
            else:
                task_id = await self._start_sunoapi_org_job(
                    client,
                    script=script,
                    voice_persona_id=voice_persona_id,
                    music_style_prompt=music_style_prompt,
                )

            stream_pick = await self._poll_for_stream(
                client, task_id, target_duration_sec
            )
            yield (
                "stream",
                StreamReady(
                    stream_audio_url=str(stream_pick["stream_audio_url"]),
                    duration_sec=int(stream_pick["duration_sec"]),
                    candidate_id=str(stream_pick["id"]),
                    job_id=task_id,
                ),
            )

            final = await self._poll_for_final(
                client, task_id, str(stream_pick["id"]), target_duration_sec
            )
            audio_url = str(final["audio_url"])
            audio_res = await client.get(audio_url)
            audio_res.raise_for_status()

            yield (
                "final",
                AudioResult(
                    audio_bytes=audio_res.content,
                    mime_type="audio/mpeg",
                    duration_sec=int(float(final.get("duration") or target_duration_sec)),
                    job_ids=[task_id],
                    candidate_count=int(final.get("candidate_count") or 1),
                    chosen_candidate=int(final.get("chosen_index") or 0),
                    latency_ms=int((time.monotonic() - t0) * 1000),
                ),
            )

    async def _synthesize_acedata(
        self,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Locale,
        candidates: int,
    ) -> AudioResult:
        _ = (reference_track_urls, locale)
        t0 = time.monotonic()
        n = max(1, min(2, candidates))

        async with httpx.AsyncClient(timeout=POLL_TIMEOUT_SEC + 30) as client:
            jobs = await asyncio.gather(
                *(
                    self._start_acedata_job(
                        client,
                        script=script,
                        voice_persona_id=voice_persona_id,
                        music_style_prompt=music_style_prompt,
                    )
                    for _ in range(n)
                )
            )
            job_ids = [job["task_id"] for job in jobs if job.get("task_id")]

            all_candidates: list[dict[str, Any]] = []
            for job in jobs:
                immediate = job.get("candidates") or []
                if immediate:
                    all_candidates.extend(immediate)
                elif job.get("task_id"):
                    all_candidates.extend(await self._poll_acedata(client, str(job["task_id"])))

            chosen = self._choose_candidate(all_candidates, target_duration_sec)
            if chosen is None:
                ids = ",".join(job_ids)
                raise RuntimeError(f"suno: no candidate produced audio (job ids: {ids})")

            audio_url = str(chosen["audio_url"])
            audio_res = await client.get(audio_url)
            audio_res.raise_for_status()

        return AudioResult(
            audio_bytes=audio_res.content,
            mime_type="audio/mpeg",
            duration_sec=int(chosen.get("duration") or target_duration_sec),
            job_ids=job_ids,
            candidate_count=len(all_candidates),
            chosen_candidate=all_candidates.index(chosen),
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    async def _start_acedata_job(
        self,
        client: httpx.AsyncClient,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "action": "generate",
            "custom": True,
            "instrumental": False,
            "lyric": script,
            "style": (
                music_style_prompt
                + "; spoken word, slow narration, no melody on vocals, breathy delivery"
            ),
            "title": "Kokoro meditation",
            "model": ACEDATA_MODEL,
        }
        if voice_persona_id:
            body["persona_id"] = voice_persona_id

        res = await client.post(
            f"{self._base_url}/audios",
            headers={"authorization": f"Bearer {self._api_key}"},
            json=body,
        )
        res.raise_for_status()
        payload = res.json()
        task_id = payload.get("task_id") or payload.get("id")
        data = payload.get("data")
        candidates = data if isinstance(data, list) else []
        if not task_id and not candidates:
            raise RuntimeError("suno start: no task_id or data in response")
        return {"task_id": task_id, "candidates": candidates}

    async def _poll_acedata(self, client: httpx.AsyncClient, task_id: str) -> list[dict[str, Any]]:
        deadline = time.monotonic() + POLL_TIMEOUT_SEC
        while time.monotonic() < deadline:
            res = await client.post(
                f"{self._base_url}/tasks",
                headers={"authorization": f"Bearer {self._api_key}"},
                json={"id": task_id, "action": "retrieve"},
            )
            res.raise_for_status()
            payload = res.json()
            response = payload.get("response") or payload
            data = response.get("data") if isinstance(response, dict) else None
            if isinstance(data, list) and data:
                candidates = [item for item in data if isinstance(item, dict)]
                if any(item.get("audio_url") for item in candidates):
                    return candidates
            state = str(response.get("state") or response.get("status") or "").lower()
            if state in FAILED_STATUSES:
                raise RuntimeError(f"suno task {task_id} errored: {response}")
            await asyncio.sleep(POLL_INTERVAL_SEC)
        raise TimeoutError(f"suno task {task_id} timed out after {POLL_TIMEOUT_SEC}s")

    async def _synthesize_sunoapi_org(
        self,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Locale,
    ) -> AudioResult:
        _ = locale
        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=POLL_TIMEOUT_SEC + 30) as client:
            if reference_track_urls:
                upload_url = await self._prepare_reference_upload_url(
                    client,
                    reference_track_urls[0],
                )
                task_id = await self._start_sunoapi_org_upload_cover_job(
                    client,
                    upload_url=upload_url,
                    script=script,
                    voice_persona_id=voice_persona_id,
                    music_style_prompt=music_style_prompt,
                )
            else:
                task_id = await self._start_sunoapi_org_job(
                    client,
                    script=script,
                    voice_persona_id=voice_persona_id,
                    music_style_prompt=music_style_prompt,
                )
            all_candidates = await self._poll_sunoapi_org(client, task_id)

            chosen = self._choose_candidate(all_candidates, target_duration_sec)
            if chosen is None:
                raise RuntimeError(f"suno: no candidate produced audio (job ids: {task_id})")

            audio_url = str(chosen["audio_url"])
            audio_res = await client.get(audio_url)
            audio_res.raise_for_status()

        return AudioResult(
            audio_bytes=audio_res.content,
            mime_type="audio/mpeg",
            duration_sec=int(float(chosen.get("duration") or target_duration_sec)),
            job_ids=[task_id],
            candidate_count=len(all_candidates),
            chosen_candidate=all_candidates.index(chosen),
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    async def _prepare_reference_upload_url(self, client: httpx.AsyncClient, ref: str) -> str:
        local_path = self._local_ref_path(ref)
        if local_path is None:
            return ref
        if not local_path.exists():
            raise RuntimeError(f"suno reference track not found: {local_path}")

        cached = await get_cached_url(local_path)
        if cached:
            log.info("suno.ref.cache_hit", ref=local_path.name, upload_url=cached)
            return cached

        log.info("suno.ref.cache_miss", ref=local_path.name)
        res = await client.post(
            f"{SUNOAPI_FILE_BASE_URL}/api/file-stream-upload",
            headers={"authorization": f"Bearer {self._api_key}"},
            files={"file": (local_path.name, local_path.read_bytes(), "audio/mpeg")},
            data={"uploadPath": "kokoro-reference-tracks", "fileName": local_path.name},
        )
        res.raise_for_status()
        payload = res.json()
        data = payload.get("data") or {}
        # sunoapi.org file-stream-upload returns the public link as `downloadUrl`
        # (older docs called it `fileUrl`; keep the fallback in case it returns).
        file_url = data.get("downloadUrl") or data.get("fileUrl")
        if not payload.get("success") or not file_url:
            raise RuntimeError(f"suno reference upload failed: {payload}")
        upload_url = str(file_url)
        await put_cached_url(local_path, upload_url)
        return upload_url

    @staticmethod
    def _local_ref_path(ref: str) -> Path | None:
        parsed = urlparse(ref)
        if parsed.hostname not in {"localhost", "127.0.0.1"}:
            return None
        if not parsed.path.startswith("/refs/"):
            return None
        return Path("refs") / unquote(parsed.path.removeprefix("/refs/"))

    async def _start_sunoapi_org_job(
        self,
        client: httpx.AsyncClient,
        *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
    ) -> str:
        body: dict[str, Any] = {
            "customMode": True,
            "instrumental": False,
            "model": SUNOAPI_MODEL,
            "callBackUrl": self._callback_url,
            "prompt": script,
            "style": self._trim_style(music_style_prompt),
            "title": "Kokoro meditation",
            "negativeTags": (
                "fast dance beat, heavy drums, aggressive melody, "
                "singing, sung vocals, melodic vocals, chorus, verse, rap, "
                "rhyming, song structure, melody on vocals, pop vocals, autotune"
            ),
        }
        vocal_gender = self._infer_vocal_gender(music_style_prompt)
        if vocal_gender:
            body["vocalGender"] = vocal_gender
        if voice_persona_id:
            body["personaId"] = voice_persona_id
            body["personaModel"] = "voice_persona"

        log.info(
            "suno.generate.request",
            url=f"{self._base_url}/api/v1/generate",
            body=body,
        )

        res = await client.post(
            f"{self._base_url}/api/v1/generate",
            headers={"authorization": f"Bearer {self._api_key}"},
            json=body,
        )
        res.raise_for_status()
        payload = res.json()
        log.info("suno.generate.response", code=payload.get("code"), data=payload.get("data"))
        if payload.get("code") != 200:
            raise RuntimeError(f"sunoapi generate failed: {payload}")
        task_id = (payload.get("data") or {}).get("taskId")
        if not task_id:
            raise RuntimeError("sunoapi start: no taskId in response")
        return str(task_id)

    async def _start_sunoapi_org_upload_cover_job(
        self,
        client: httpx.AsyncClient,
        *,
        upload_url: str,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
    ) -> str:
        # `upload-cover` tells sunoapi.org "listen to this clip and produce a
        # NEW song in a similar style with these new lyrics". Unlike
        # `upload-extend`, it does NOT copy any seconds from the reference
        # into the output — the reference only informs vocal character and
        # musical vibe. This is what we want for meditation generation:
        # transcripts already feed the LLM with content; the audio reference
        # only shapes how that content sounds.
        body: dict[str, Any] = {
            "uploadUrl": upload_url,
            "model": SUNOAPI_MODEL,
            "callBackUrl": self._callback_url,
            "customMode": True,
            "instrumental": False,
            "prompt": script,
            "style": self._trim_style(music_style_prompt),
            "title": "Kokoro meditation",
            "negativeTags": (
                "fast dance beat, heavy drums, aggressive melody, foreign language, "
                "singing, sung vocals, melodic vocals, chorus, verse, rap, "
                "rhyming, song structure, melody on vocals, pop vocals, autotune"
            ),
        }
        vocal_gender = self._infer_vocal_gender(music_style_prompt)
        if vocal_gender:
            body["vocalGender"] = vocal_gender
        if voice_persona_id:
            body["personaId"] = voice_persona_id
            body["personaModel"] = "voice_persona"

        log.info(
            "suno.upload_cover.request",
            url=f"{self._base_url}/api/v1/generate/upload-cover",
            body=body,
        )

        res = await client.post(
            f"{self._base_url}/api/v1/generate/upload-cover",
            headers={"authorization": f"Bearer {self._api_key}"},
            json=body,
        )
        res.raise_for_status()
        payload = res.json()
        log.info("suno.upload_cover.response", code=payload.get("code"), data=payload.get("data"))
        if payload.get("code") != 200:
            raise RuntimeError(f"sunoapi upload-cover failed: {payload}")
        task_id = (payload.get("data") or {}).get("taskId")
        if not task_id:
            raise RuntimeError("sunoapi upload-cover: no taskId in response")
        return str(task_id)

    async def _poll_sunoapi_org(
        self,
        client: httpx.AsyncClient,
        task_id: str,
    ) -> list[dict[str, Any]]:
        deadline = time.monotonic() + POLL_TIMEOUT_SEC
        while time.monotonic() < deadline:
            res = await client.get(
                f"{self._base_url}/api/v1/generate/record-info",
                headers={"authorization": f"Bearer {self._api_key}"},
                params={"taskId": task_id},
            )
            res.raise_for_status()
            payload = res.json()
            if payload.get("code") != 200:
                raise RuntimeError(f"sunoapi record-info failed: {payload}")

            data = payload.get("data") or {}
            status = str(data.get("status") or "").lower()
            if status in FAILED_STATUSES:
                raise RuntimeError(f"sunoapi task {task_id} errored: {data}")

            response = data.get("response") or {}
            suno_data = response.get("sunoData") if isinstance(response, dict) else None
            if isinstance(suno_data, list) and status == "success":
                candidates = self._normalize_sunoapi_candidates(suno_data)
                if candidates:
                    return candidates

            await asyncio.sleep(POLL_INTERVAL_SEC)
        raise TimeoutError(f"sunoapi task {task_id} timed out after {POLL_TIMEOUT_SEC}s")

    async def _poll_for_stream(
        self,
        client: httpx.AsyncClient,
        task_id: str,
        target_duration_sec: int,
    ) -> dict[str, Any]:
        """Phase 1: return the moment any candidate has a streamAudioUrl set.
        If multiple candidates have one ready in the same poll, pick by
        duration closest to target. Records the chosen item's id so phase 2
        can wait on the same candidate."""
        deadline = time.monotonic() + POLL_TIMEOUT_SEC
        while time.monotonic() < deadline:
            res = await client.get(
                f"{self._base_url}/api/v1/generate/record-info",
                headers={"authorization": f"Bearer {self._api_key}"},
                params={"taskId": task_id},
            )
            res.raise_for_status()
            payload = res.json()
            if payload.get("code") != 200:
                raise RuntimeError(f"sunoapi record-info failed: {payload}")

            data = payload.get("data") or {}
            status = str(data.get("status") or "").lower()
            if status in FAILED_STATUSES:
                raise RuntimeError(f"sunoapi task {task_id} errored: {data}")

            response = data.get("response") or {}
            suno_data = response.get("sunoData") if isinstance(response, dict) else None
            if isinstance(suno_data, list) and suno_data:
                streamables: list[dict[str, Any]] = []
                for item in suno_data:
                    if not isinstance(item, dict):
                        continue
                    stream_url = item.get("streamAudioUrl") or item.get("audioUrl")
                    if not stream_url:
                        continue
                    streamables.append(
                        {
                            "id": item.get("id"),
                            "stream_audio_url": stream_url,
                            "duration_sec": int(
                                float(item.get("duration") or target_duration_sec)
                            ),
                        }
                    )
                if streamables:

                    def distance(c: dict[str, Any]) -> float:
                        return abs(int(c["duration_sec"]) - target_duration_sec)

                    return min(streamables, key=distance)

            await asyncio.sleep(POLL_INTERVAL_SEC)
        raise TimeoutError(f"sunoapi task {task_id} stream timed out after {POLL_TIMEOUT_SEC}s")

    async def _poll_for_final(
        self,
        client: httpx.AsyncClient,
        task_id: str,
        chosen_id: str,
        target_duration_sec: int,
    ) -> dict[str, Any]:
        """Phase 2: keep polling until status==success AND the chosen
        candidate has a final audioUrl. Returns that candidate's normalized
        dict (audio_url + duration + id)."""
        deadline = time.monotonic() + POLL_TIMEOUT_SEC
        while time.monotonic() < deadline:
            res = await client.get(
                f"{self._base_url}/api/v1/generate/record-info",
                headers={"authorization": f"Bearer {self._api_key}"},
                params={"taskId": task_id},
            )
            res.raise_for_status()
            payload = res.json()
            if payload.get("code") != 200:
                raise RuntimeError(f"sunoapi record-info failed: {payload}")

            data = payload.get("data") or {}
            status = str(data.get("status") or "").lower()
            if status in FAILED_STATUSES:
                raise RuntimeError(f"sunoapi task {task_id} errored: {data}")

            response = data.get("response") or {}
            suno_data = response.get("sunoData") if isinstance(response, dict) else None
            # Accept both FIRST_SUCCESS (chosen candidate's audioUrl is
            # populated as soon as Suno finishes its first track) and
            # SUCCESS (all tracks final). For our purposes the chosen
            # candidate's mastered audioUrl at FIRST_SUCCESS is identical
            # to what arrives at SUCCESS — waiting for SUCCESS just adds
            # 30-60s while the OTHER candidate finishes.
            if isinstance(suno_data, list) and status in ("first_success", "success"):
                normalized = self._normalize_sunoapi_candidates(suno_data)
                same_id = next(
                    (c for c in normalized if str(c.get("id")) == chosen_id),
                    None,
                )
                if same_id and same_id.get("audio_url"):
                    same_id["candidate_count"] = len(normalized)
                    same_id["chosen_index"] = next(
                        (i for i, c in enumerate(normalized) if str(c.get("id")) == chosen_id),
                        0,
                    )
                    same_id["target_duration_sec"] = target_duration_sec
                    return same_id

            await asyncio.sleep(POLL_INTERVAL_SEC)
        raise TimeoutError(f"sunoapi task {task_id} final timed out after {POLL_TIMEOUT_SEC}s")

    @staticmethod
    def _normalize_sunoapi_candidates(raw: list[Any]) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            audio_url = item.get("audioUrl") or item.get("streamAudioUrl")
            if not audio_url:
                continue
            candidates.append(
                {
                    "audio_url": audio_url,
                    "duration": item.get("duration"),
                    "id": item.get("id"),
                }
            )
        return candidates

    @staticmethod
    def _trim_style(style: str) -> str:
        return style[:1000]

    @staticmethod
    def _infer_vocal_gender(style: str) -> str | None:
        lowered = style.lower()
        if "female" in lowered:
            return "f"
        if "male" in lowered:
            return "m"
        return None

    @staticmethod
    def _choose_candidate(
        candidates: list[dict[str, Any]],
        target_duration_sec: int,
    ) -> dict[str, Any] | None:
        with_audio = [candidate for candidate in candidates if candidate.get("audio_url")]
        if not with_audio:
            return None

        def distance(candidate: dict[str, Any]) -> float:
            duration = float(candidate.get("duration") or target_duration_sec)
            return abs(duration - target_duration_sec)

        return min(with_audio, key=distance)
