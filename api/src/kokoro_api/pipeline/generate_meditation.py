from __future__ import annotations

from dataclasses import dataclass

import structlog
from pydantic import BaseModel

from kokoro_api.pipeline.validate_lyrics import validate_meditation_output
from kokoro_api.prompt.parse import parse_llm_output
from kokoro_api.prompt.system import build_system_prompt
from kokoro_api.prompt.user import BuildUserArgs, HistoryDict, build_user_prompt
from kokoro_api.providers.llm.base import ScriptGenerator
from kokoro_api.types import LlmMeta, Locale, Template

log = structlog.get_logger()

WRITER_CACHE_KEY = "writer_v2"  # bump invalidates Anthropic cache after the rewrite


@dataclass(slots=True)
class GenerateMeditationInput:
    call_me: str
    capture_text: str
    template: Template
    history: HistoryDict | None
    locale: Locale


class GenerateMeditationResult(BaseModel):
    style: str
    lyrics: str
    estimated_duration_sec: int
    validation_warnings: list[str]
    meta: LlmMeta


async def generate_meditation(
    input: GenerateMeditationInput,
    llm: ScriptGenerator,
) -> GenerateMeditationResult:
    system_prompt = build_system_prompt(locale=input.locale)
    user_prompt = build_user_prompt(
        BuildUserArgs(
            call_me=input.call_me,
            capture_text=input.capture_text,
            template=input.template,
            history=input.history,
        )
    )

    log.info(
        "writer.prompts_built",
        template_id=input.template.id,
        vibe=input.template.vibe,
        target_duration_sec=input.template.target_duration_sec,
        locale=input.locale,
        call_me=input.call_me,
        system_prompt_length=len(system_prompt),
        user_prompt_length=len(user_prompt),
        capture_text_preview=input.capture_text[:200],
    )

    last_err: Exception | None = None
    total_latency = 0
    total_in = 0
    total_out = 0
    total_cache = 0

    last_validation_warnings: list[str] = []
    prompt_for_attempt = user_prompt
    last_parsed = None

    for attempt in range(2):
        result = await llm.generate(
            system_prompt=system_prompt,
            user_prompt=prompt_for_attempt,
            cache_key=WRITER_CACHE_KEY,
        )
        log.info(
            "writer.llm_response",
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
        except Exception as exc:
            last_err = exc
            log.warning(
                "writer.parse_failed",
                attempt=attempt,
                error=str(exc),
                raw_preview=result.raw_json[:500],
            )
            prompt_for_attempt = (
                f"{user_prompt}\n\n"
                "Your previous response was invalid JSON. Return ONLY one JSON object with "
                "fields `style`, `lyrics`, `estimatedDurationSec`. No markdown, no prose. "
                f"Validation error: {exc}"
            )
            continue

        violations = validate_meditation_output(
            style=parsed.style, lyrics=parsed.lyrics, call_me=input.call_me
        )
        last_parsed = parsed
        last_validation_warnings = violations

        if not violations:
            return GenerateMeditationResult(
                style=parsed.style,
                lyrics=parsed.lyrics,
                estimated_duration_sec=parsed.estimated_duration_sec,
                validation_warnings=[],
                meta=LlmMeta(
                    provider=llm.name,
                    model=llm.model,
                    latency_ms=total_latency,
                    tokens_in=total_in,
                    tokens_out=total_out,
                    cache_read_tokens=total_cache,
                ),
            )

        log.warning(
            "writer.validation_failed",
            attempt=attempt,
            violations=violations,
        )
        prompt_for_attempt = (
            f"{user_prompt}\n\n"
            "Your previous output failed these MEDITATION rules (this is a SPOKEN MEDITATION, "
            "NOT a song — re-read the system prompt):\n- "
            + "\n- ".join(violations)
            + "\n\nFix every violation. Re-emit the full JSON object."
        )

    if last_parsed is not None:
        log.warning(
            "writer.shipping_with_warnings",
            violations=last_validation_warnings,
        )
        return GenerateMeditationResult(
            style=last_parsed.style,
            lyrics=last_parsed.lyrics,
            estimated_duration_sec=last_parsed.estimated_duration_sec,
            validation_warnings=last_validation_warnings,
            meta=LlmMeta(
                provider=llm.name,
                model=llm.model,
                latency_ms=total_latency,
                tokens_in=total_in,
                tokens_out=total_out,
                cache_read_tokens=total_cache,
            ),
        )

    raise RuntimeError(f"meditation generation failed after retries: {last_err}")
