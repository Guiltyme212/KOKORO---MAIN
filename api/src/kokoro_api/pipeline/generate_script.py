from __future__ import annotations

from dataclasses import dataclass

import structlog
from pydantic import BaseModel

from kokoro_api.prompt.parse import parse_llm_output
from kokoro_api.prompt.system import build_system_prompt
from kokoro_api.prompt.user import BuildUserArgs, HistoryDict, build_user_prompt
from kokoro_api.providers.llm.base import ScriptGenerator
from kokoro_api.types import LlmMeta, Locale, Mode, Template

log = structlog.get_logger()


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

    log.info(
        "script.prompts_built",
        template_id=input.template.id,
        locale=input.locale,
        mode=input.mode,
        call_me=input.call_me,
        system_prompt_length=len(system_prompt),
        user_prompt_length=len(user_prompt),
        user_prompt_preview=user_prompt[:600],
        capture_text_preview=input.capture_text[:200],
    )

    last_err: Exception | None = None
    total_latency = 0
    total_in = 0
    total_out = 0
    total_cache = 0

    prompt_for_attempt = user_prompt
    for attempt in range(2):
        result = await llm.generate(
            system_prompt=system_prompt,
            user_prompt=prompt_for_attempt,
            cache_key=input.template.id,
        )
        log.info(
            "script.llm_response",
            attempt=attempt,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cache_read_tokens=result.cache_read_tokens,
            latency_ms=result.latency_ms,
            raw_preview=result.raw_json[:500],
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
            log.warning(
                "script.parse_failed",
                attempt=attempt,
                error=str(exc),
                raw_preview=result.raw_json[:500],
            )
            prompt_for_attempt = (
                f"{user_prompt}\n\n"
                "Your previous response was invalid. Return ONLY one JSON object matching the "
                "schema. Do not include markdown, comments, prose, or any text before/after JSON. "
                f"Validation error: {exc}"
            )

    raise RuntimeError(f"script generation failed after retries: {last_err}")
