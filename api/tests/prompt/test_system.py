from __future__ import annotations

import re

from kokoro_api.prompt.system import build_system_prompt


def test_opens_with_meditation_not_song_warning() -> None:
    prompt = build_system_prompt(mode="soft", locale="en")
    assert "SPOKEN-WORD GUIDED MEDITATION" in prompt
    assert re.search(r"not a song", prompt, re.I)
    assert re.search(r"no singing", prompt, re.I)
    assert re.search(r"no chorus", prompt, re.I)
    assert re.search(r"no verse", prompt, re.I) or re.search(r"\[Verse\]", prompt)


def test_requires_pet_name_at_least_3_times() -> None:
    prompt = build_system_prompt(mode="soft", locale="en")
    assert re.search(r"at least 3 times", prompt, re.I)
    assert re.search(r"pet name", prompt, re.I)


def test_soft_mode_register_warm_validating() -> None:
    prompt = build_system_prompt(mode="soft", locale="en")
    assert re.search(r"warm", prompt, re.I)
    assert re.search(r"validating", prompt, re.I)


def test_sharp_mode_register_direct_grounded() -> None:
    prompt = build_system_prompt(mode="sharp", locale="en")
    assert re.search(r"direct", prompt, re.I)
    assert re.search(r"grounded", prompt, re.I)


def test_emits_new_output_schema() -> None:
    prompt = build_system_prompt(mode="soft", locale="en")
    assert '"style"' in prompt
    assert '"lyrics"' in prompt
    assert '"estimatedDurationSec"' in prompt
    # Old fields must NOT be in the prompt.
    assert '"script"' not in prompt
    assert '"beats"' not in prompt


def test_requires_spoken_word_tags_and_forbids_song_tags() -> None:
    prompt = build_system_prompt(mode="soft", locale="en")
    assert "[Intro: ambient, no singing]" in prompt
    assert "[Spoken word, slow]" in prompt
    assert "[Breath]" in prompt
    assert "[Pause]" in prompt
    # Song tags must be explicitly forbidden.
    for tag in ("[Verse]", "[Chorus]", "[Hook]", "[Bridge]", "[Refrain]"):
        assert tag in prompt  # listed in NEVER use


def test_russian_locale_hint() -> None:
    prompt = build_system_prompt(mode="soft", locale="ru")
    assert re.search(r"russian", prompt, re.I)
