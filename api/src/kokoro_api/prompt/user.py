from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from kokoro_api.types import Template, Vibe


class HistoryDict(TypedDict, total=False):
    previous_scripts: list[str]
    last_vibe: Vibe


@dataclass(slots=True)
class BuildUserArgs:
    call_me: str
    capture_text: str
    template: Template
    history: HistoryDict | None


def build_user_prompt(args: BuildUserArgs) -> str:
    history_block = ""
    if args.history and (args.history.get("previous_scripts") or args.history.get("last_vibe")):
        previous_scripts = args.history.get("previous_scripts") or []
        previous_lines = "\n".join(
            f'  - "{script[:280].replace(chr(10), " ")}..."' for script in previous_scripts
        )
        history_block = (
            f"<history>\n"
            f"last_vibe: {args.history.get('last_vibe', 'unknown')}\n"
            f"previous_scripts:\n{previous_lines}\n"
            f"</history>\n\n"
        )

    capture_text = args.capture_text.replace('"', '\\"')
    template = args.template

    source_block = (
        "<source_meditation>\n"
        "This is the full transcript of an existing meditation that matches the chosen vibe.\n"
        "Use it as RAW MATERIAL for cadence, intimacy, and structure — not as a template to copy "
        "phrase-by-phrase.\n"
        f"{template.transcript.strip()}\n"
        "</source_meditation>\n\n"
    )

    return f"""<user_context>
pet_name: {args.call_me}
vibe: {template.vibe}
target_duration_sec: {template.target_duration_sec}
what_they_said: "{capture_text}"
</user_context>

<vibe_directive>
{template.writer_directive.strip()}
</vibe_directive>

{source_block}{history_block}TASK: Personalize the situation in <user_context> into a brand new SPOKEN-WORD MEDITATION (not a song) in the register described in <vibe_directive>. Use the <source_meditation> above as raw material — adopt its pacing, intimacy, and emotional cadence — but rewrite specifics so the meditation lands FOR THIS user (use their pet name ≥3 times naturally, reference what they said). Do not copy the source meditation verbatim or quote long phrases from it.

Aim for roughly {template.target_duration_sec} seconds of spoken content (rough guide, not strict).

Follow ALL the rules in the system prompt AND the vibe-specific style in <vibe_directive>. First line `[Intro: ambient, no singing]`, second line `[Spoken word, slow]`, no `[Verse]`/`[Chorus]`/`[Hook]`/`[Bridge]`, no rhyming. Return strict JSON only with `style`, `lyrics`, `estimatedDurationSec`."""
