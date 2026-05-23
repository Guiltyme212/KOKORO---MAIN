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
    real_name: str | None = None


_GENERIC_CALL_ME = {"", "friend", "user", "пользователь", "человек"}


def _is_generic(call_me: str) -> bool:
    return call_me.strip().lower() in _GENERIC_CALL_ME


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
    generic = _is_generic(args.call_me)
    pet_name_line = (
        "pet_name: (not provided — address the user in plain second person, do NOT invent endearments like 'зай'/'sweetheart')"
        if generic
        else f"pet_name: {args.call_me}"
    )
    pet_name_task = (
        "speak directly in second person ('ты'/'you') without any pet-name address"
        if generic
        else "use their pet name ≥3 times naturally"
    )
    real_name = (args.real_name or "").strip()
    real_name_line = (
        "real_name: (not provided)"
        if not real_name
        else f"real_name: {real_name}"
    )

    source_block = (
        "<source_meditation>\n"
        "This is the full transcript of an existing meditation that matches the chosen vibe.\n"
        "Use it as RAW MATERIAL for cadence, intimacy, and structure — not as a template to copy "
        "phrase-by-phrase.\n"
        f"{template.transcript.strip()}\n"
        "</source_meditation>\n\n"
    )

    return f"""<user_context>
{pet_name_line}
{real_name_line}
vibe: {template.vibe}
target_duration_sec: {template.target_duration_sec}
what_they_said: "{capture_text}"
</user_context>

<vibe_directive>
{template.writer_directive.strip()}
</vibe_directive>

{source_block}{history_block}TASK: Personalize the situation in <user_context> into a brand new SPOKEN-WORD MEDITATION (not a song) in the register described in <vibe_directive>. Use the <source_meditation> above as raw material — adopt its pacing, intimacy, and emotional cadence — but rewrite specifics so the meditation lands FOR THIS user ({pet_name_task}, reference what they said). Do not copy the source meditation verbatim or quote long phrases from it.

Aim for roughly {template.target_duration_sec} seconds of spoken content (rough guide, not strict).

Follow ALL the rules in the system prompt AND the vibe-specific style in <vibe_directive>. First line MUST be `[Narration over ambient music. Do not sing. Speak naturally, like a calm podcast voice.]`. Use `[slow breath]` and `[short pause]` cues between paragraphs. End with a `[Outro. Calm spoken voice. No singing.]` block before the final 1–2 closing paragraphs. Capitalized sentences in normal paragraph form (the vibe's tone lives in word choice, not in typography). No `[Verse]`/`[Chorus]`/`[Hook]`/`[Bridge]`, no `[Intro:]`/`[Spoken word]`/`[Breath]`/`[Pause]`, no rhyming. Return strict JSON only with `style`, `lyrics`, `estimatedDurationSec`."""
