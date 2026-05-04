from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import structlog
from pydantic import BaseModel

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.prompt.picker import (
    BuildPickerArgs,
    build_picker_system_prompt,
    build_picker_user_prompt,
)
from kokoro_api.providers.llm.base import ScriptGenerator
from kokoro_api.types import Becoming, ContentType, LlmMeta, Locale, Mode

log = structlog.get_logger()

PICKER_CACHE_KEY = "picker_v1"


@dataclass(slots=True)
class PickReferencesInput:
    capture_text: str
    call_me: str
    mode: Mode
    content_type: ContentType
    becoming: Becoming | None
    locale: Locale


class PickReferencesResult(BaseModel):
    picked: list[ReferenceMeditation]
    meta: LlmMeta

    model_config = {"arbitrary_types_allowed": True}


class _PickerOutput(BaseModel):
    # We accept any item shape (int, numeric str, exact filename str, or dict
    # with `id` key — Opus has been observed to use all four) and dispatch in
    # `_resolve_ref` ourselves. A pydantic union of these types triggered a
    # platform-specific UnicodeEncodeError on Windows (cp1252) when the schema
    # was generated alongside the Cyrillic-laden catalog context — list[Any]
    # avoids the schema interaction entirely.
    picked: list[Any] | None = None
    # Opus has been observed to use the field name "references" instead of
    # "picked"; accept it as an alias.
    references: list[Any] | None = None


async def pick_references(
    input: PickReferencesInput,
    llm: ScriptGenerator,
    library: list[ReferenceMeditation],
) -> PickReferencesResult:
    # The catalog presented to the LLM uses short numeric IDs (1..N by sort
    # order). Map back to ReferenceMeditation by index.
    by_short_id = {index: ref for index, ref in enumerate(library, start=1)}
    # Also accept exact filename matches as a fallback for backward compat /
    # forgiving parsing.
    by_filename = {ref.id: ref for ref in library}
    system_prompt = build_picker_system_prompt(library)
    base_user_prompt = build_picker_user_prompt(
        BuildPickerArgs(
            capture_text=input.capture_text,
            call_me=input.call_me,
            mode=input.mode,
            content_type=input.content_type,
            becoming=input.becoming,
            locale=input.locale,
        ),
        library,
    )
    log.info(
        "picker.prompts_built",
        library_size=len(library),
        system_prompt_length=len(system_prompt),
        user_prompt_length=len(base_user_prompt),
        capture_text_preview=input.capture_text[:200],
    )

    last_err: Exception | None = None
    total_latency = 0
    total_in = 0
    total_out = 0
    total_cache = 0
    user_prompt = base_user_prompt

    for attempt in range(2):
        result = await llm.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            cache_key=PICKER_CACHE_KEY,
        )
        log.info(
            "picker.llm_response",
            attempt=attempt,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cache_read_tokens=result.cache_read_tokens,
            latency_ms=result.latency_ms,
            raw_preview=result.raw_json[:300],
        )
        total_latency += result.latency_ms
        total_in += result.tokens_in
        total_out += result.tokens_out
        total_cache += result.cache_read_tokens
        try:
            picked = _parse_and_validate(result.raw_json, by_short_id, by_filename)
            log.info(
                "picker.picked",
                picked_ids=[ref.id for ref in picked],
                attempt=attempt,
            )
            return PickReferencesResult(
                picked=picked,
                meta=LlmMeta(
                    provider=llm.name,
                    model=llm.model,
                    latency_ms=total_latency,
                    tokens_in=total_in,
                    tokens_out=total_out,
                    cache_read_tokens=total_cache,
                ),
            )
        except Exception as exc:
            last_err = exc
            log.warning(
                "picker.parse_failed",
                attempt=attempt,
                error=str(exc),
                raw_preview=result.raw_json[:300],
            )
            user_prompt = (
                f"{base_user_prompt}\n\n"
                "Your previous response was invalid. Return ONLY this JSON shape:\n"
                '{"picked": [<int>, <int>]}\n'
                "where each <int> is a real numeric id from the catalog. Use the field "
                'name "picked" (not "references"). Do not invent ids. '
                f"Validation error: {exc}"
            )

    raise RuntimeError(f"reference picker failed after retries: {last_err}")


def _parse_and_validate(
    raw: str,
    by_short_id: dict[int, ReferenceMeditation],
    by_filename: dict[str, ReferenceMeditation],
) -> list[ReferenceMeditation]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    parsed_dict = json.loads(cleaned)
    parsed = _PickerOutput.model_validate(parsed_dict)

    raw_items = parsed.picked or parsed.references
    if not raw_items:
        raise ValueError(
            'picker returned empty/missing array (need {"picked": [...]} with 1-3 items)'
        )
    if len(raw_items) > 3:
        raise ValueError(f"picker returned {len(raw_items)} ids; max is 3")

    seen: set[int | str] = set()
    out: list[ReferenceMeditation] = []
    for raw_item in raw_items:
        ref = _resolve_ref(raw_item, by_short_id, by_filename)
        # Dedupe on the resolved filename so dict-vs-int-vs-string don't
        # double-count the same reference.
        if ref.id in seen:
            continue
        seen.add(ref.id)
        out.append(ref)
    return out


def _resolve_ref(
    raw_item: object,
    by_short_id: dict[int, ReferenceMeditation],
    by_filename: dict[str, ReferenceMeditation],
) -> ReferenceMeditation:
    """Map any of {int, numeric str, exact filename str, dict with id} → real ref."""
    # Unwrap dict shape: {"id": ..., "reason": ...}
    if isinstance(raw_item, dict):
        inner = raw_item.get("id")
        if inner is None:
            raise ValueError(f"picker dict item missing 'id': {raw_item!r}")
        return _resolve_ref(inner, by_short_id, by_filename)

    if isinstance(raw_item, int):
        ref = by_short_id.get(raw_item)
        if ref is None:
            raise ValueError(
                f"picker returned out-of-range id {raw_item}; valid range is 1..{len(by_short_id)}"
            )
        return ref

    if isinstance(raw_item, str):
        # Try numeric first ("12" → 12), then exact filename match.
        if raw_item.strip().isdigit():
            return _resolve_ref(int(raw_item.strip()), by_short_id, by_filename)
        ref = by_filename.get(raw_item)
        if ref is None:
            raise ValueError(f"picker returned unknown id: {raw_item!r}")
        return ref

    raise ValueError(f"picker returned id of unexpected type: {raw_item!r}")
