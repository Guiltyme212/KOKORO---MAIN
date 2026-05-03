from __future__ import annotations

import json

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class LlmParsed(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    script: str
    estimated_duration_sec: int


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

    return LlmParsed.model_validate(parsed)


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
