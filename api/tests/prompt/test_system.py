from __future__ import annotations

import re

from kokoro_api.prompt.system import build_system_prompt


def test_soft_mode_requires_pet_name_4_times() -> None:
    prompt = build_system_prompt(mode="soft", locale="en")
    assert re.search(r"at least 4 times", prompt, re.I)
    assert re.search(r"pet name", prompt, re.I)
    assert re.search(r"warm", prompt, re.I)


def test_sharp_mode_register_shifts() -> None:
    prompt = build_system_prompt(mode="sharp", locale="en")
    assert re.search(r"direct", prompt, re.I)
    assert "sweet" not in prompt.lower()


def test_includes_json_output_contract() -> None:
    prompt = build_system_prompt(mode="soft", locale="en")
    assert '"script"' in prompt
    assert '"estimatedDurationSec"' in prompt
    assert "[breath]" in prompt
    # We dropped beats from the schema for MVP; make sure the prompt does not ask for it.
    assert '"beats"' not in prompt
    assert "startSec" not in prompt


def test_russian_locale_hint() -> None:
    prompt = build_system_prompt(mode="soft", locale="ru")
    assert re.search(r"russian", prompt, re.I)
