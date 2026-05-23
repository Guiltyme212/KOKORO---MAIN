# kokoro-api

Backend for Kokoro meditation generation. Python 3.14 + FastAPI.

## Endpoints

**`POST /meditations/stream`** (primary, NDJSON streaming) — same orchestration as `/meditations` but yields three events as they happen:

- `script` (~20–45s) — LLM finished writing personalized lyrics; client now knows lyrics/style/vibe.
- `streaming` (~30–90s) — Suno's `streamAudioUrl` is populated; the client advances to Player and plays this URL immediately. This is the audio the user *hears*.
- `ready` (~90–180s) — final mastered audio downloaded and persisted; client gets the long-lived blob URL for replay/library.

Errors during the stream surface as a final `{"event":"error", ...}` line, never as an HTTP error after the response has started.

**`POST /meditations`** (legacy, single JSON response) — same pipeline drained synchronously into one `GenerateMeditationOutput`. Used by tests, scripts, and library replay.

**`GET /health`** returns `{"ok": true, "ts": ...}`.

Both meditation endpoints orchestrate:

1. capture resolution (`text` / `theme` passthrough, `voice` via ElevenLabs or Whisper when an audio URL exists)
2. rule-based template selection from `templates/`
3. LLM script generation (Anthropic via CliProxy by default; OpenAI when `LLM_PROVIDER=openai`)
4. Suno audio generation through sunoapi.org's `upload-cover` endpoint
5. audio + metadata persistence through the configured blob store

## Dev

```sh
cp .env.example .env             # fill placeholder secrets (≥20 chars each)
uv sync --all-extras
uv run uvicorn kokoro_api.main:app --reload --port 8787
```

Then `curl http://localhost:8787/health` should return `{"ok":true,"ts":...}`.

For the frontend, set `VITE_API_BASE=http://localhost:8787` and run `pnpm dev` in `apps/web/`.

## Tests

```sh
uv run pytest                    # unit tests only
uv run pytest --integration      # also runs upstream-API contract tests (costs money)
```

## Lint + types

```sh
uv run ruff check
uv run ruff format
uv run mypy src
```

## Pipeline notes

- `pipeline/orchestrator.py` exposes both `run_pipeline` (legacy, returns one `GenerateMeditationOutput`) and `run_pipeline_streaming` (yields the `script` / `streaming` / `ready` events used by `POST /meditations/stream`).
- `pipeline/generate_meditation.py` calls the LLM **once**. Validation retries are gone — formatting issues (missing `[Intro]` markers, missing `no singing` phrase, forbidden song tags, oversize lyrics) are fixed silently in `pipeline/validate_lyrics.py::coerce_meditation_output`. Only JSON parse failures trigger a retry.
- `pipeline/synthesize_audio.py` wraps the audio provider; `voice_persona_id` is currently always `""` (no persona path in production).

## Provider notes

- `providers/stt/elevenlabs.py` downloads the voice URL and calls ElevenLabs Scribe (`scribe_v2` by default). It is preferred when `ELEVENLABS_API_KEY` is set.
- `providers/stt/whisper.py` remains as a fallback when `WHISPER_API_KEY` is set and ElevenLabs is not.
- `providers/llm/anthropic_provider.py` uses the official Anthropic SDK with `base_url` pointed at CliProxy. `providers/llm/openai_provider.py` is the alternate path when `LLM_PROVIDER=openai`.
- `providers/audio/suno.py` targets `sunoapi.org`. With reference tracks present (the normal case), it uses `/api/v1/generate/upload-cover` with the first resolved reference clip; without them it falls back to plain `/api/v1/generate`. The streaming method polls in two phases:
  - `_poll_for_stream` — returns the moment any candidate has a non-empty `streamAudioUrl` (typically at Suno status `TEXT_SUCCESS`, ~30–90s in). The chosen candidate's `id` is recorded so phase 2 waits on the same one.
  - `_poll_for_final` — returns when the same candidate's mastered `audioUrl` is populated. Accepts both `FIRST_SUCCESS` (chosen candidate done) and `SUCCESS` (all candidates done) as terminal — taking the earlier signal saves ~30–60s vs. waiting for full `SUCCESS`.
- `providers/audio/suno_ref_cache.py` caches the `uploadUrl` returned by `/api/file-stream-upload` per local reference file (`apps/api/blob-data/_suno_ref_cache.json`, 48h TTL). On a hot cache, every request after the first skips the ~10–13s reference upload. Cold cache: first request after a deploy still pays the upload cost.
- `apps/api/refs/` contains public 60-second reference clips that get uploaded to Suno when the cache is cold. Local `/refs/*` URLs are recognised by the localhost-aware path resolver in `_local_ref_path`; non-localhost reference URLs pass through unchanged.
- `POST /suno/callback` is a no-op webhook target for providers that require a callback URL while the API still polls for completion.
- `providers/blob/filesystem.py` is the local dev store mounted at `/blob`; `providers/blob/s3.py` is intentionally still a stub until the R2 bucket is provisioned.

## Layout

See `docs/plans/2026-05-03-meditation-generation.md` for the full implementation plan and `docs/plans/2026-05-03-meditation-infra.md` for the deployment / provisioning doc.
