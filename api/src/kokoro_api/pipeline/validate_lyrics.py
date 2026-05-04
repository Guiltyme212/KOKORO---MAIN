from __future__ import annotations

import re

MAX_LYRICS_CHARS = 5000
MIN_PET_NAME_OCCURRENCES = 3

_FORBIDDEN_TAGS = ("[verse", "[chorus", "[hook", "[bridge", "[refrain", "(chorus)", "(verse)")
_REQUIRED_LYRICS_MARKERS = ("[intro", "[spoken word")
_REQUIRED_STYLE_PHRASES = ("spoken", "no singing")
# Standalone words; matched with word boundaries (so "popular" / "trance" don't
# trip "pop") AND a negative lookbehind for "no " (so "no rap" doesn't trip
# "rap" — the system prompt REQUIRES the style to say "no rap"/"no rhymes",
# we only want to flag positive uses of these genres).
_FORBIDDEN_STYLE_WORDS = ("pop", "dance", "edm", "rap")


def validate_meditation_output(*, style: str, lyrics: str, call_me: str) -> list[str]:
    """Return a list of human-readable rule violations for a meditation output.
    Empty list = valid. The orchestrator/writer uses this to decide whether to
    re-prompt the LLM."""
    violations: list[str] = []

    if len(lyrics) > MAX_LYRICS_CHARS:
        violations.append(
            f"lyrics is {len(lyrics)} chars; must be ≤ {MAX_LYRICS_CHARS}"
        )

    pet_name_count = _count_substring_ci(lyrics, call_me)
    if pet_name_count < MIN_PET_NAME_OCCURRENCES:
        violations.append(
            f"pet name '{call_me}' appears {pet_name_count} times in lyrics; "
            f"must appear at least {MIN_PET_NAME_OCCURRENCES} times"
        )

    lyrics_lower = lyrics.lower()
    missing_markers = [m for m in _REQUIRED_LYRICS_MARKERS if m not in lyrics_lower]
    if missing_markers:
        violations.append(
            "lyrics is missing required spoken-word markers: "
            + ", ".join(missing_markers)
            + " (the first line MUST be `[Intro: ambient, no singing]` and the second `[Spoken word, slow]`)"
        )

    forbidden_in_lyrics = [t for t in _FORBIDDEN_TAGS if t in lyrics_lower]
    if forbidden_in_lyrics:
        violations.append(
            "lyrics contains forbidden song-structure tags: "
            + ", ".join(forbidden_in_lyrics)
            + " — this is a SPOKEN MEDITATION, not a song. Remove all of these."
        )

    style_lower = style.lower()
    missing_style = [p for p in _REQUIRED_STYLE_PHRASES if p not in style_lower]
    if missing_style:
        violations.append(
            "style is missing required phrases: "
            + ", ".join(missing_style)
            + " — every style string must explicitly say `spoken` and `no singing`."
        )

    forbidden_style = [
        word for word in _FORBIDDEN_STYLE_WORDS if _word_in(style_lower, word)
    ]
    if forbidden_style:
        violations.append(
            "style contains forbidden music-genre words: "
            + ", ".join(forbidden_style)
            + " — keep the bed ambient/cinematic, not pop/dance/edm/rap."
        )

    return violations


def _count_substring_ci(haystack: str, needle: str) -> int:
    if not needle:
        return 0
    return haystack.lower().count(needle.lower())


def _word_in(text: str, word: str) -> bool:
    # Match the word with boundaries on both sides, but NOT when preceded by "no ".
    # The system prompt requires phrases like "no rap"/"no rhymes" in style — those
    # mentions of the genre are valid; only positive uses ("trap rap energy") fail.
    return bool(re.search(rf"(?<!no )\b{re.escape(word)}\b", text))
