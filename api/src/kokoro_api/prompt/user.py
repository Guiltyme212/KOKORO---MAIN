from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.types import Mode


class HistoryDict(TypedDict, total=False):
    previous_scripts: list[str]
    last_becoming: str


@dataclass(slots=True)
class BuildUserArgs:
    call_me: str
    mode: Mode
    capture_text: str
    becoming: str | None
    references: list[ReferenceMeditation]
    target_duration_sec: int
    history: HistoryDict | None


def build_user_prompt(args: BuildUserArgs) -> str:
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
            f"</history>\n\n"
        )

    sources_block = _build_sources_block(args.references)
    capture_text = args.capture_text.replace('"', '\\"')

    return f"""<user_context>
pet_name: {args.call_me}
mode: {args.mode}
becoming: {args.becoming or "unspecified"}
target_duration_sec: {args.target_duration_sec}
what_they_said: "{capture_text}"
</user_context>

{sources_block}{history_block}TASK: Personalize the situation in <user_context> into a brand new SPOKEN-WORD MEDITATION (not a song). Use the SOURCE_MEDITATIONS above as raw material — adopt their pacing, intimacy, and emotional cadence — but rewrite specifics so the meditation lands FOR THIS user (use their pet name ≥3 times naturally, reference what they said). Do not copy the source meditations verbatim or quote long phrases from them.

Aim for roughly {args.target_duration_sec} seconds of spoken content (rough guide, not strict).

Follow ALL the rules in the system prompt — especially: first line `[Intro: ambient, no singing]`, second line `[Spoken word, slow]`, no `[Verse]`/`[Chorus]`/`[Hook]`/`[Bridge]`, no rhyming, style field includes `spoken-word guided meditation` and `no singing`. Return strict JSON only with `style`, `lyrics`, `estimatedDurationSec`."""


def _build_sources_block(references: list[ReferenceMeditation]) -> str:
    if not references:
        return ""

    blocks: list[str] = []
    for index, ref in enumerate(references, start=1):
        blocks.append(
            f"--- SOURCE {index} (id={ref.id}) ---\n"
            f"{ref.full_text}\n"
        )

    body = "\n".join(blocks)
    return (
        "<source_meditations>\n"
        "These are full transcripts of existing real meditations matching the user's situation.\n"
        "Use them as raw material for cadence, intimacy, and structure — not as templates to copy phrase-by-phrase.\n"
        f"{body}"
        "</source_meditations>\n\n"
    )
