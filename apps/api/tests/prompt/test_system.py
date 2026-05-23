from __future__ import annotations

import re

from kokoro_api.prompt.system import build_system_prompt


def test_opens_with_meditation_not_song_warning() -> None:
    prompt = build_system_prompt(locale="en")
    assert re.search(r"spoken-word", prompt, re.I)
    assert re.search(r"not.*song|never.*song", prompt, re.I)
    assert re.search(r"no singing", prompt, re.I)
    assert re.search(r"no chorus", prompt, re.I)


def test_requires_pet_name_at_least_4_times() -> None:
    prompt = build_system_prompt(locale="en")
    assert re.search(r"at least 4 times", prompt, re.I)
    assert re.search(r"pet name", prompt, re.I)


def test_emits_strict_json_with_style_and_lyrics() -> None:
    prompt = build_system_prompt(locale="en")
    assert '"style"' in prompt
    assert '"lyrics"' in prompt
    # The new prompt does not require any other field — estimatedDurationSec
    # is optional, beats/script are forbidden.
    assert '"script"' not in prompt
    assert '"beats"' not in prompt


def test_lists_spoken_word_tags_and_forbids_song_tags() -> None:
    prompt = build_system_prompt(locale="en")
    # Suno tags the model is allowed to emit
    assert "[Intro:" in prompt
    assert "[Spoken word" in prompt
    assert "[Breath]" in prompt
    assert "[Pause]" in prompt
    assert "[Outro:" in prompt
    # Forbidden song tags must be enumerated
    for tag in ("[Verse]", "[Chorus]", "[Bridge]", "[Hook]", "[Refrain]"):
        assert tag in prompt


def test_includes_safety_addiction_grief_blocks() -> None:
    prompt = build_system_prompt(locale="en")
    assert re.search(r"safety", prompt, re.I)
    assert re.search(r"addiction", prompt, re.I)
    assert re.search(r"grief", prompt, re.I)


def test_russian_locale_hint() -> None:
    prompt = build_system_prompt(locale="ru")
    assert re.search(r"russian", prompt, re.I)
