# Scripts

## transcribe_references.py — source meditation transcription

The pipeline can use full transcripts of existing meditations as source
material for personalization (see `prompt/user.py:_build_sources_block`).
Transcripts live inside template JSON files under `transcript`.

To produce them:

1. Drop your source audio files into `api/reference-sources/*.mp3`
   (this directory is git-ignored — files are kept local).
2. Make sure `ELEVENLABS_API_KEY` is set in `api/.env` (the script reuses
   the same provider configuration as the running API).
3. From the `api/` directory:

   ```sh
   uv run python scripts/transcribe_references.py             # default: en
   uv run python scripts/transcribe_references.py --locale ru
   uv run python scripts/transcribe_references.py --force     # overwrite existing
   ```

4. The script writes `<basename>.txt` next to each `.mp3`. Open the
   transcript, sanity-check it, then paste the text into the matching
   template JSON's `transcript` field (e.g.
   `api/templates/unwind/unwind_release_pressure_01.json`):

   ```json
   {
     "id": "unwind_release_pressure_01",
     ...
     "transcript": "<paste full meditation text here>",
     "transcriptSource": "Sasha Belyakova — Anxiety & Panic"
   }
   ```

   Without `transcript`, the LLM falls back to writing from beat-intent
   metadata only (current behavior — works, just less rich).

Transcripts are .txt-gitignored to avoid accidentally committing
copyrighted material (the JSON templates ARE committed — only commit
transcripts you own or have explicit rights to).

---

# Persona bootstrap (post-MVP)

When we have 4 high-quality reference vocal recordings (Mira / Brad / Aiko / Sage, 30-60 sec each, recorded in a quiet room), we upload them once to Suno and bind them to the existing voice IDs.

Process (deferred, not part of MVP):

1. Drop recordings at `api/scripts/reference-vocals/{voice}.mp3`.
2. Run `uv run python scripts/bootstrap_personas.py` (script not yet written, write when needed).
3. The script uploads each clip to Suno's persona endpoint, captures the returned `persona_id`, and writes the values into `api/src/kokoro_api/providers/audio/voice_presets.json` next to the existing `style_hint` strings.
4. From that moment on, `synthesize_audio` passes `persona_id` to Suno and the voice stays more consistent across sessions.

Until then, voice drift between generations is an accepted MVP risk.
