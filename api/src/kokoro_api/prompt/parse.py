from __future__ import annotations

import json

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class LlmParsed(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    # min_length=1 catches the case where coercion (script as empty array, or
    # array of dicts without text/Text/content) produces an empty string.
    # Empty script means Suno will hallucinate vocal content from the reference
    # track instead of speaking our meditation. Triggering a retry is cheaper
    # than producing a broken audio.
    script: str = Field(min_length=1)
    # LLM frequently forgets this field. Pipeline doesn't actually use it
    # (we rely on template.target_duration_sec and audio.duration_sec from Suno),
    # so default to 0 rather than burning a retry on missing duration.
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
    """LLMs sometimes return `script` as an array of beat-like objects, or
    as a single dict, or stash the script under `beats` while leaving
    `script` empty. Flatten anything reasonable into a single string."""
    script = parsed.get("script")
    if isinstance(script, list):
        parsed["script"] = _join_text_pieces(script)
    elif isinstance(script, dict):
        text = script.get("text") if isinstance(script.get("text"), str) else None
        parsed["script"] = text or json.dumps(script, ensure_ascii=False)
    elif script is None:
        beats = parsed.get("beats")
        if isinstance(beats, list):
            parsed["script"] = _join_text_pieces(beats)
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
