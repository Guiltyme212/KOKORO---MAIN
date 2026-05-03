# Persona bootstrap (post-MVP)

When we have 4 high-quality reference vocal recordings (Mira / Brad / Aiko / Sage, 30-60 sec each, recorded in a quiet room), we upload them once to Suno and bind them to the existing voice IDs.

Process (deferred, not part of MVP):

1. Drop recordings at `api/scripts/reference-vocals/{voice}.mp3`.
2. Run `uv run python scripts/bootstrap_personas.py` (script not yet written, write when needed).
3. The script uploads each clip to Suno's persona endpoint, captures the returned `persona_id`, and writes the values into `api/src/kokoro_api/providers/audio/voice_presets.json` next to the existing `style_hint` strings.
4. From that moment on, `synthesize_audio` passes `persona_id` to Suno and the voice stays more consistent across sessions.

Until then, voice drift between generations is an accepted MVP risk.
