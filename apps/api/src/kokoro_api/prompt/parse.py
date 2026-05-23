from __future__ import annotations

import json

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class LlmParsed(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    # Suno-bound style string. Validator enforces "spoken" + "no singing"
    # downstream; we only check non-empty here so a malformed empty string
    # triggers a retry rather than a Suno call with no style guidance.
    style: str = Field(min_length=10)
    # Spoken-word meditation text. Empty lyrics means Suno will hallucinate
    # vocal content from the reference track instead of speaking our text;
    # triggering a retry is cheaper than producing broken audio.
    lyrics: str = Field(min_length=1)
    # LLM frequently forgets this field. Pipeline doesn't actually use it
    # (we rely on template.target_duration_sec and audio.duration_sec from
    # Suno), so default to 0 rather than burning a retry on missing duration.
    estimated_duration_sec: int = 0


def parse_llm_output(raw: str) -> LlmParsed:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    elif not cleaned.startswith("{"):
        cleaned = _extract_json_object(cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"could not parse llm output as json: {exc.msg}") from exc

    if isinstance(parsed, dict):
        parsed = _coerce_shape(parsed)

    return LlmParsed.model_validate(parsed)


def _coerce_shape(parsed: dict[str, object]) -> dict[str, object]:
    """LLMs sometimes return `lyrics` as an array of beat-like objects, or a
    single dict, or stash the text under `script`/`beats`. Flatten anything
    reasonable into a single string. Same for `style` if it arrives as a list."""
    lyrics = parsed.get("lyrics")
    if isinstance(lyrics, list):
        parsed["lyrics"] = _join_text_pieces(lyrics)
    elif isinstance(lyrics, dict):
        text = lyrics.get("text") if isinstance(lyrics.get("text"), str) else None
        parsed["lyrics"] = text or json.dumps(lyrics, ensure_ascii=False)
    elif lyrics is None:
        # Backwards compat: model sometimes uses old `script` field name, or
        # stashes content under `beats`.
        for fallback in ("script", "beats"):
            value = parsed.get(fallback)
            if isinstance(value, str) and value.strip():
                parsed["lyrics"] = value
                break
            if isinstance(value, list):
                joined = _join_text_pieces(value)
                if joined:
                    parsed["lyrics"] = joined
                    break

    style = parsed.get("style")
    if isinstance(style, list):
        parsed["style"] = ", ".join(s for s in style if isinstance(s, str))
    elif isinstance(style, dict):
        # Take the first string-valued field as a fallback.
        for value in style.values():
            if isinstance(value, str) and value.strip():
                parsed["style"] = value
                break
    return parsed


def _join_text_pieces(items: list[object]) -> str:
    parts: list[str] = []
    for item in items:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            text = item.get("text") or item.get("Text") or item.get("content")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
    return "\n\n".join(parts)


def _extract_json_object(raw: str) -> str:
    start = raw.find("{")
    if start < 0:
        return raw

    depth = 0
    in_string = False
    escaped = False
    for i, ch in enumerate(raw[start:], start=start):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return raw[start : i + 1]

    return raw[start:]
