from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from kokoro_api.providers.audio.suno import SunoAudioProvider

PRESETS_PATH = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "kokoro_api"
    / "providers"
    / "audio"
    / "voice_presets.json"
)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_suno_produces_short_clip() -> None:
    presets = json.loads(PRESETS_PATH.read_text(encoding="utf-8"))
    provider = SunoAudioProvider(
        base_url=os.environ["SUNO_BASE_URL"],
        api_key=os.environ["SUNO_API_KEY"],
    )
    result = await provider.synthesize(
        script="Settle. [breath] You did enough today.",
        voice_persona_id=presets["mira"]["persona_id"],
        music_style_prompt="warm ambient pad, no percussion",
        reference_track_urls=[],
        target_duration_sec=30,
        locale="en",
        candidates=1,
    )
    assert len(result.audio_bytes) > 20_000
    assert result.duration_sec > 15
