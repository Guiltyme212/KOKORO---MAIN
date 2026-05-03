from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel

from kokoro_api.prompt.parse import parse_llm_output
from kokoro_api.prompt.system import build_system_prompt
from kokoro_api.prompt.user import BuildUserArgs, HistoryDict, build_user_prompt
from kokoro_api.providers.llm.base import ScriptGenerator
from kokoro_api.types import LlmMeta, Locale, Mode, Template


@dataclass(slots=True)
class GenerateScriptInput:
    call_me: str
    mode: Mode
    capture_text: str
    becoming: str | None
    template: Template
    history: HistoryDict | None
    locale: Locale


class GenerateScriptResult(BaseModel):
    script: str
    estimated_duration_sec: int
    meta: LlmMeta


async def generate_script(
    input: GenerateScriptInput,
    llm: ScriptGenerator,
) -> GenerateScriptResult:
    system_prompt = build_system_prompt(mode=input.mode, locale=input.locale)
    user_prompt = build_user_prompt(
        BuildUserArgs(
            call_me=input.call_me,
            mode=input.mode,
            capture_text=input.capture_text,
            becoming=input.becoming,
            template=input.template,
            history=input.history,
        )
    )

    last_err: Exception | None = None
    total_latency = 0
    total_in = 0
    total_out = 0
    total_cache = 0

    prompt_for_attempt = user_prompt
    for _attempt in range(2):
        result = await llm.generate(
            system_prompt=system_prompt,
            user_prompt=prompt_for_attempt,
            cache_key=input.template.id,
        )
        total_latency += result.latency_ms
        total_in += result.tokens_in
        total_out += result.tokens_out
        total_cache += result.cache_read_tokens
        try:
            parsed = parse_llm_output(result.raw_json)
            return GenerateScriptResult(
                script=parsed.script,
                estimated_duration_sec=parsed.estimated_duration_sec,
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
            prompt_for_attempt = (
                f"{user_prompt}\n\n"
                "Your previous response was invalid. Return ONLY one JSON object matching the "
                "schema. Do not include markdown, comments, prose, or any text before/after JSON. "
                f"Validation error: {exc}"
            )

    raise RuntimeError(f"script generation failed after retries: {last_err}")
