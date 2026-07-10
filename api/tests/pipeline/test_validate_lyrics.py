from __future__ import annotations

from kokoro_api.pipeline.validate_lyrics import (
    MAX_LYRICS_CHARS,
    coerce_meditation_output,
    enforce_max_lyrics_length,
)

PREAMBLE = (
    "[Narration over ambient music. Do not sing. Speak naturally, like a calm podcast voice.]"
)


def test_keeps_current_narration_format() -> None:
    style, lyrics = coerce_meditation_output(
        style="guided meditation, narration over ambient music, no singing",
        lyrics=f"{PREAMBLE}\nBreathe slowly.\n[Outro. Calm spoken voice. No singing.]",
    )
    assert style == "guided meditation, narration over ambient music, no singing"
    assert lyrics.startswith(PREAMBLE)


def test_replaces_deprecated_and_song_tags_with_narration_preamble() -> None:
    _, lyrics = coerce_meditation_output(
        style="guided meditation, no singing",
        lyrics=(
            "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
            "[Verse 1]\nHello. [Breath] Stay here. [Pause]\n[Chorus]\n[Outro: fading]"
        ),
    )
    assert lyrics.startswith(PREAMBLE)
    for forbidden in ("[Intro:", "[Spoken word", "[Verse", "[Breath]", "[Pause]", "[Chorus]"):
        assert forbidden not in lyrics


def test_repairs_style_without_another_llm_call() -> None:
    style, _ = coerce_meditation_output(
        style="warm pop dance edm rap bed",
        lyrics="A quiet minute.",
    )
    assert "narration over ambient music" in style
    assert "no singing" in style
    for forbidden in ("pop", "dance", "edm", "rap"):
        assert forbidden not in style.split()


def test_negative_no_rap_phrase_is_preserved() -> None:
    style, _ = coerce_meditation_output(
        style="guided meditation, narration over ambient music, no singing, no rap",
        lyrics="A quiet minute.",
    )
    assert "no rap" in style


def test_enforce_max_lyrics_length_passes_through_when_under_cap() -> None:
    lyrics = f"{PREAMBLE}\nBreathe."
    assert enforce_max_lyrics_length(lyrics) == lyrics


def test_enforce_max_lyrics_length_truncates_oversize_keeping_outro() -> None:
    body = "Breathe. " * 1500
    lyrics = f"{PREAMBLE}\n{body}\n[Outro: fading slowly into silence]"
    assert len(lyrics) > MAX_LYRICS_CHARS

    truncated = enforce_max_lyrics_length(lyrics)
    assert len(truncated) <= MAX_LYRICS_CHARS
    assert truncated.endswith("[Outro: fading slowly into silence]")
    assert truncated.startswith(PREAMBLE)


def test_enforce_max_lyrics_length_synthesizes_outro_when_missing() -> None:
    lyrics = f"{PREAMBLE}\n" + ("Breathe. " * 2000)
    truncated = enforce_max_lyrics_length(lyrics)
    assert len(truncated) <= MAX_LYRICS_CHARS
    assert truncated.endswith("[Outro: fading]")
