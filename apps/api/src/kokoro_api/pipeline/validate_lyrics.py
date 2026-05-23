from __future__ import annotations

import re

MAX_LYRICS_CHARS = 5000
# Suno's custom-mode hard cap is 5000 chars; we trim a hair below to leave
# room for the closing [Outro] tag and stay safely under the boundary.
TRUNCATE_TARGET_CHARS = 4990

# Strip song-structure tags AND the deprecated [Intro:]/[Spoken word]/[Breath]/
# [Pause] tags so they don't conflict with the new production-cue format.
_FORBIDDEN_TAG_PATTERN = re.compile(
    r"\[(?:verse|chorus|hook|bridge|refrain|intro:|spoken word[^\]]*|breath\]|pause\]|break \d+\s*sec)[^\]]*\]"
    r"|\((?:chorus|verse)\)",
    re.IGNORECASE,
)
# The known-good production-cue preamble (matches the user's working suno.com
# format). Auto-prepended only if the lyrics don't already start with a
# narration-style cue.
_NARRATION_PREAMBLE = (
    "[Narration over ambient music. Do not sing. Speak naturally, like a calm podcast voice.]\n"
)
# At least one of these substrings must appear in the style; if none do, we
# append the canonical "narration over ambient music" phrase.
_REQUIRED_STYLE_ANY_OF_NARRATION = (
    "narration over ambient music",
    "close-mic podcast voice",
    "spoken-word meditation",
    "guided meditation",
)
_REQUIRED_STYLE_NO_SINGING = "no singing"
# Standalone words; matched with word boundaries (so "popular" / "trance" don't
# trip "pop") AND a negative lookbehind for "no " (so "no rap" doesn't trip
# "rap" — the style is allowed to say "no rap"/"no rhymes", we only want to
# scrub positive uses of these genres).
_FORBIDDEN_STYLE_WORDS = ("pop", "dance", "edm", "rap")


def coerce_meditation_output(*, style: str, lyrics: str) -> tuple[str, str]:
    """Apply deterministic post-processing to make any LLM response Suno-safe.

    Replaces the previous validate-then-retry loop. Each rule is a silent text
    fix — no LLM re-call. Saves ~22-25s per request that would have retried.

    Fixes applied:
    - Strip forbidden song-structure tags AND the deprecated [Intro:]/
      [Spoken word]/[Breath]/[Pause] tags from lyrics.
    - Prepend the `[Narration over ambient music. ...]` preamble if the lyrics
      don't already start with a bracketed narration cue.
    - Append "no singing" / "narration over ambient music" to the style if
      missing.
    - Scrub forbidden music-genre words ("pop", "dance", "edm", "rap") from style.
    - Hard-trim lyrics to ≤ 5000 chars (Suno cap), preserving the closing [Outro].
    """
    fixed_lyrics = _FORBIDDEN_TAG_PATTERN.sub("", lyrics).lstrip("\n")
    first_line = fixed_lyrics.split("\n", 1)[0].lower()
    has_preamble = first_line.startswith("[") and (
        "narration" in first_line or "podcast" in first_line
    )
    if not has_preamble:
        fixed_lyrics = _NARRATION_PREAMBLE + fixed_lyrics
    fixed_lyrics = enforce_max_lyrics_length(fixed_lyrics)

    fixed_style = _scrub_forbidden_style_words(style)
    fixed_style_lower = fixed_style.lower()
    additions: list[str] = []
    if not any(p in fixed_style_lower for p in _REQUIRED_STYLE_ANY_OF_NARRATION):
        additions.append("narration over ambient music")
    if _REQUIRED_STYLE_NO_SINGING not in fixed_style_lower:
        additions.append(_REQUIRED_STYLE_NO_SINGING)
    if additions:
        fixed_style = fixed_style.rstrip(", ") + ", " + ", ".join(additions)

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
