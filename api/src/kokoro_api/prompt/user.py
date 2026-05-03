from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from kokoro_api.types import Mode, Template


class HistoryDict(TypedDict, total=False):
    previous_scripts: list[str]
    last_becoming: str


@dataclass(slots=True)
class BuildUserArgs:
    call_me: str
    mode: Mode
    capture_text: str
    becoming: str | None
    # First element is the primary template (used for music + structure).
    # Any subsequent ones contribute their transcripts as source material.
    templates: list[Template]
    history: HistoryDict | None


def build_user_prompt(args: BuildUserArgs) -> str:
    primary = args.templates[0]
    beat_lines = "\n".join(
        f'  - id="{beat.id}" sec={beat.sec} intent="{beat.intent}"'
        for beat in primary.structure
    )

    history_block = ""
    if args.history and (args.history.get("previous_scripts") or args.history.get("last_becoming")):
        previous_scripts = args.history.get("previous_scripts") or []
        previous_lines = "\n".join(
            f'  - "{script[:280].replace(chr(10), " ")}..."' for script in previous_scripts
        )
        history_block = (
            f"<history>\n"
            f"last_becoming: {args.history.get('last_becoming', 'unknown')}\n"
            f"previous_scripts:\n{previous_lines}\n"
            f"</history>\n"
        )

    sources_block = _build_sources_block(args.templates)

    capture_text = args.capture_text.replace('"', '\\"')
    register_note = (
        primary.register_notes.soft
        if args.mode == "soft"
        else primary.register_notes.sharp
    )

    return f"""<user_context>
pet_name: {args.call_me}
mode: {args.mode}
becoming: {args.becoming or "unspecified"}
what_they_said: "{capture_text}"
</user_context>

<template id="{primary.id}" target_duration_sec={primary.target_duration_sec}>
register_note ({args.mode}): {register_note}
beats:
{beat_lines}
</template>
{sources_block}{history_block}
TASK: Personalize the situation in <user_context> into a brand new meditation.
Use the SOURCE_MEDITATIONS above as raw material — adopt their pacing, register,
and structural cadence — but rewrite specifics so the meditation lands FOR THIS user
(use their pet name, reference what they said). Do not copy the source meditations
verbatim or quote long phrases from them. The output must feel original to this user.

Follow the rules in the system prompt. Return strict JSON only."""


def _build_sources_block(templates: list[Template]) -> str:
    sources: list[tuple[Template, str]] = []
    for template in templates:
        transcript = (template.transcript or "").strip()
        if transcript:
            sources.append((template, transcript))
    if not sources:
        return ""

    blocks: list[str] = []
    for index, (template, transcript) in enumerate(sources, start=1):
        intent = ", ".join(beat.intent for beat in template.structure)
        blocks.append(
            f"--- SOURCE {index} (template_id={template.id}, intent={intent}) ---\n"
            f"{transcript}\n"
        )

    body = "\n".join(blocks)
    return (
        "<source_meditations>\n"
        "These are full transcripts of existing meditations that match the user's situation.\n"
        "Use them as raw material to transform — not as examples to imitate phrase-by-phrase.\n"
        f"{body}"
        "</source_meditations>\n\n"
    )
