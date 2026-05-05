from __future__ import annotations

import re

MAX_LYRICS_CHARS = 5000
# Suno's custom-mode hard cap is 5000 chars; we trim a hair below to leave
# room for the closing [Outro] tag and stay safely under the boundary.
TRUNCATE_TARGET_CHARS = 4990

_FORBIDDEN_TAG_PATTERN = re.compile(
    r"\[(?:verse|chorus|hook|bridge|refrain)[^\]]*\]|\((?:chorus|verse)\)",
    re.IGNORECASE,
)
_REQUIRED_INTRO_LINES = "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
_REQUIRED_STYLE_PHRASES = ("spoken", "no singing")
# Standalone words; matched with word boundaries (so "popular" / "trance" don't
# trip "pop") AND a negative lookbehind for "no " (so "no rap" doesn't trip
# "rap" — the system prompt allows phrases like "no rap"/"no rhymes",
# we only want to scrub positive uses of these genres).
_FORBIDDEN_STYLE_WORDS = ("pop", "dance", "edm", "rap")


def coerce_meditation_output(*, style: str, lyrics: str) -> tuple[str, str]:
    """Apply deterministic post-processing to make any LLM response Suno-safe.

    Replaces the previous validate-then-retry loop. Each rule that used to
    trigger a re-call of the LLM is now a silent text fix, since they're all
    deterministic formatting concerns. Saves ~22-25s on every request that
    would have triggered a retry.

    Fixes applied:
    - Strip forbidden song-structure tags from lyrics ([verse], [chorus], …)
    - Prepend the required `[Intro: …]` / `[Spoken word, slow]` markers if absent
    - Append "spoken" / "no singing" to style if missing
    - Scrub forbidden music-genre words ("pop", "dance", "edm", "rap") from style
    - Hard-trim lyrics to ≤ 5000 chars (Suno cap), preserving the closing [Outro]
    """
    fixed_lyrics = _FORBIDDEN_TAG_PATTERN.sub("", lyrics)
    if "[intro" not in fixed_lyrics.lower() or "[spoken word" not in fixed_lyrics.lower():
        fixed_lyrics = _REQUIRED_INTRO_LINES + fixed_lyrics.lstrip("\n")
    fixed_lyrics = enforce_max_lyrics_length(fixed_lyrics)

    fixed_style = _scrub_forbidden_style_words(style)
    fixed_style_lower = fixed_style.lower()
    missing_phrases = [p for p in _REQUIRED_STYLE_PHRASES if p not in fixed_style_lower]
    if missing_phrases:
        suffix = ", " + ", ".join(missing_phrases)
        fixed_style = fixed_style.rstrip(", ") + suffix

    return fixed_style, fixed_lyrics


def enforce_max_lyrics_length(lyrics: str) -> str:
    """Defense-in-depth: if the LLM came back with > 5000 chars, hard-trim at
    the last newline before TRUNCATE_TARGET_CHARS and re-append the original
    [Outro] tag (or a fallback) so the track has a proper close. Returns the
    input unchanged when already within budget."""
    if len(lyrics) <= MAX_LYRICS_CHARS:
        return lyrics

    outro_match = re.search(r"\[Outro:[^\]]*\]", lyrics)
    outro_tag = outro_match.group(0) if outro_match else "[Outro: fading]"

    budget = TRUNCATE_TARGET_CHARS - len(outro_tag) - 1
    if budget <= 0:
        return outro_tag[:MAX_LYRICS_CHARS]

    cut = lyrics.rfind("\n", 0, budget)
    if cut <= 0:
        cut = budget

    return lyrics[:cut].rstrip() + "\n" + outro_tag


def _scrub_forbidden_style_words(style: str) -> str:
    out = style
    for word in _FORBIDDEN_STYLE_WORDS:
        out = re.sub(rf"(?<!no )\b{re.escape(word)}\b", "", out, flags=re.IGNORECASE)
    # Collapse the comma/space artifacts left behind by deletions:
    # "ambient , slow" → "ambient, slow", ",, " → ", ", trim ends.
    out = re.sub(r"\s+,", ",", out)
    out = re.sub(r",\s*,+", ",", out)
    out = re.sub(r"\s{2,}", " ", out)
    out = re.sub(r"^[,\s]+|[,\s]+$", "", out)
    return out
