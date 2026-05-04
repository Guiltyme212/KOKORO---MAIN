from __future__ import annotations

from dataclasses import dataclass

from kokoro_api.library.loader import ReferenceMeditation
from kokoro_api.types import Becoming, ContentType, Locale, Mode


@dataclass(slots=True)
class BuildPickerArgs:
    capture_text: str
    call_me: str
    mode: Mode
    content_type: ContentType
    becoming: Becoming | None
    locale: Locale


def build_picker_system_prompt(library: list[ReferenceMeditation]) -> str:
    """Short, generic system prompt. The catalog lives in the user prompt
    instead — our cli-proxy at ANTHROPIC_BASE_URL truncates/strips long
    system prompts, so anything load-bearing must go user-side."""
    _ = library
    return """You are choosing reference meditations for a Kokoro SPOKEN-WORD GUIDED MEDITATION (not a song). The writer that consumes your picks is forbidden from writing songs, lyrics, choruses, or anything sung. Your job is to pick 1 to 3 references whose CONTENT, EMOTIONAL SITUATION, and CADENCE most closely match what the user is going through right now. Match emotional situation, not surface keywords. Match the user's content type (unwind/attract/lockin) when possible, but emotional fit beats content_type fit. Return strict JSON only — no prose, no markdown."""


def build_picker_user_prompt(args: BuildPickerArgs, library: list[ReferenceMeditation]) -> str:
    """The catalog is embedded here (not in the system prompt) because the
    cli-proxy at ANTHROPIC_BASE_URL drops long system prompts but passes user
    prompts through. Without the catalog Claude hallucinates song titles."""
    catalog_lines: list[str] = []
    for index, ref in enumerate(library, start=1):
        preview = " ".join(ref.preview.split())[:200]
        catalog_lines.append(f"  {index}. [{ref.title}] {preview}")
    catalog = "\n".join(catalog_lines)
    capture_text = args.capture_text.replace('"', '\\"')

    return f"""<user_context>
pet_name: {args.call_me}
mode: {args.mode}
content_type: {args.content_type}
becoming: {args.becoming or "unspecified"}
locale: {args.locale}
what_they_said: "{capture_text}"
</user_context>

<catalog>
Each line below is one available reference meditation, formatted as `<id>. [<title>] <preview>`. The id is the leading INTEGER you must return (NOT the title, NOT a made-up name).

{catalog}
</catalog>

TASK: Pick the 1 to 3 reference ids whose emotional situation best matches <user_context>. Three only if each adds something the others don't.

OUTPUT — strict JSON, exactly this shape, nothing else:
{{"picked": [<id1>, <id2>]}}

HARD RULES:
- "picked" MUST be an array of 1, 2, or 3 INTEGERS (the leading numeric ids from the catalog above).
- Each integer MUST be a real id between 1 and {len(library)} inclusive. Do NOT invent ids like "fear_pitch_money" or "ref_anxiety". Do NOT return song titles.
- Use the field name "picked" — not "references", not "ids", not "results".
- Return ONLY the JSON object. No reasoning, no explanation, no prose, no markdown fences."""
