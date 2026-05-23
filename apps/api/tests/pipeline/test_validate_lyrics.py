from __future__ import annotations

from kokoro_api.pipeline.validate_lyrics import (
    MAX_LYRICS_CHARS,
    enforce_max_lyrics_length,
    validate_meditation_output,
)

GOOD_STYLE = (
    "Russian spoken-word guided meditation, intimate female voice, no singing, "
    "no melody on vocals, no chorus, no rap, no rhymes, slow breathing pace"
)
GOOD_LYRICS = (
    "[Intro: ambient, no singing]\n"
    "[Spoken word, slow]\n"
    "Зай, [Breath] добро пожаловать. Зай, отпусти. Зай, ты здесь. [Outro: fading]"
)


def test_good_output_has_no_violations() -> None:
    assert validate_meditation_output(style=GOOD_STYLE, lyrics=GOOD_LYRICS, call_me="Зай") == []


def test_flags_missing_pet_name_occurrences() -> None:
    lyrics = (
        "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
        "Зай, hello.\n[Outro: fading]"
    )
    violations = validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="Зай")
    assert any("pet name" in v.lower() for v in violations)


def test_pet_name_match_is_case_insensitive() -> None:
    lyrics = (
        "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
        "зай, ЗАЙ, Зай — все равно одно и то же.[Outro: fading]"
    )
    assert validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="Зай") == []


def test_flags_lyrics_over_max_chars() -> None:
    lyrics = "[Intro: ambient, no singing]\n[Spoken word, slow]\n" + ("Зай " * 5000)
    violations = validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="Зай")
    assert any(str(MAX_LYRICS_CHARS) in v for v in violations)


def test_flags_missing_intro_or_spoken_word_marker() -> None:
    lyrics = "Зай, Зай, Зай. No tags here at all."
    violations = validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="Зай")
    assert any("spoken-word markers" in v for v in violations)


def test_flags_song_structure_tags_in_lyrics() -> None:
    lyrics = (
        "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
        "Зай. Зай. Зай.\n[Verse 1]\nLa la la\n[Chorus]\nLa la la\n[Outro: fading]"
    )
    violations = validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="Зай")
    assert any("song-structure" in v for v in violations)


def test_flags_style_missing_required_phrases() -> None:
    style = "warm ambient pad"
    violations = validate_meditation_output(style=style, lyrics=GOOD_LYRICS, call_me="Зай")
    assert any("missing required phrases" in v for v in violations)


def test_flags_style_with_forbidden_genre_words() -> None:
    style = (
        "spoken-word guided meditation, no singing, but with pop influences and rap energy"
    )
    violations = validate_meditation_output(style=style, lyrics=GOOD_LYRICS, call_me="Зай")
    assert any("forbidden music-genre words" in v for v in violations)


def test_does_not_false_positive_on_substring_genres() -> None:
    # "popular", "trance" etc. should not trip "pop"/standalone-word checks.
    style = "spoken-word guided meditation, popular intimate narration, no singing"
    assert (
        validate_meditation_output(style=style, lyrics=GOOD_LYRICS, call_me="Зай") == []
    )


def test_skips_pet_name_check_when_call_me_is_generic() -> None:
    # Lyrics never mention "friend" but that's fine — we don't force the LLM
    # to repeat a generic placeholder. Other rules still apply.
    lyrics = (
        "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
        "Ты здесь. Ты дышишь.\n[Outro: fading]"
    )
    assert validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="friend") == []
    assert validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="") == []
    assert validate_meditation_output(style=GOOD_STYLE, lyrics=lyrics, call_me="пользователь") == []


def test_enforce_max_lyrics_length_passes_through_when_under_cap() -> None:
    assert enforce_max_lyrics_length(GOOD_LYRICS) == GOOD_LYRICS


def test_enforce_max_lyrics_length_truncates_oversize_keeping_outro() -> None:
    body = "Зай. " * 1500
    lyrics = (
        "[Intro: ambient, no singing]\n[Spoken word, slow]\n"
        + body
        + "\n[Outro: fading slowly into silence]"
    )
    assert len(lyrics) > MAX_LYRICS_CHARS

    truncated = enforce_max_lyrics_length(lyrics)
    assert len(truncated) <= MAX_LYRICS_CHARS
    assert truncated.endswith("[Outro: fading slowly into silence]")
    assert truncated.startswith("[Intro: ambient, no singing]")


def test_enforce_max_lyrics_length_synthesizes_outro_when_missing() -> None:
    lyrics = "[Intro: ambient, no singing]\n[Spoken word, slow]\n" + ("Зай. " * 2000)
    truncated = enforce_max_lyrics_length(lyrics)
    assert len(truncated) <= MAX_LYRICS_CHARS
    assert truncated.endswith("[Outro: fading]")
