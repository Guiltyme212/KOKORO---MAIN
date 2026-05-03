from __future__ import annotations

from pathlib import Path

from kokoro_api.providers.audio.suno import SunoAudioProvider


def test_maps_local_reference_url_to_refs_file() -> None:
    assert SunoAudioProvider._local_ref_path(
        "http://127.0.0.1:8787/refs/sasha-belair-inner-support-ref-60s.mp3"
    ) == Path("refs/sasha-belair-inner-support-ref-60s.mp3")


def test_leaves_public_reference_url_remote() -> None:
    assert SunoAudioProvider._local_ref_path("https://cdn.example/ref.mp3") is None
