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
    template: Template
    history: HistoryDict | None


def build_user_prompt(args: BuildUserArgs) -> str:
    beat_lines = "\n".join(
        f'  - id="{beat.id}" sec={beat.sec} intent="{beat.intent}"'
        for beat in args.template.structure
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

    capture_text = args.capture_text.replace('"', '\\"')
    register_note = (
        args.template.register_notes.soft
        if args.mode == "soft"
        else args.template.register_notes.sharp
    )

    return f"""<user_context>
pet_name: {args.call_me}
mode: {args.mode}
becoming: {args.becoming or "unspecified"}
what_they_said: "{capture_text}"
</user_context>

<template id="{args.template.id}" target_duration_sec={args.template.target_duration_sec}>
register_note ({args.mode}): {register_note}
beats:
{beat_lines}
</template>
{history_block}
TASK: Write the meditation script following the system rules and the template beats.
Return strict JSON only."""
