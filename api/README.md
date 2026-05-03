# kokoro-api

Backend for Kokoro meditation generation. Python 3.12 + FastAPI.

## Endpoint

`POST /meditations` orchestrates:

1. capture resolution (`text` / `theme` passthrough, `voice` via ElevenLabs or Whisper when an audio URL exists)
2. rule-based template selection from `../templates`
3. Anthropic script generation through CliProxy
4. Suno audio generation through sunoapi.org
5. audio + metadata persistence through a blob store

`GET /health` returns `{"ok": true, "ts": ...}`.

## Dev

```sh
cp .env.example .env             # fill placeholder secrets (≥20 chars each)
uv sync --all-extras
uv run uvicorn kokoro_api.main:app --reload --port 8787
```

Then `curl http://localhost:8787/health` should return `{"ok":true,"ts":...}`.

For the frontend, set `VITE_API_BASE=http://localhost:8787` and run `pnpm dev` in `app/`.

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

## Provider notes

- `providers/stt/elevenlabs.py` downloads the voice URL and calls ElevenLabs Scribe (`scribe_v2` by default). It is preferred when `ELEVENLABS_API_KEY` is set.
- `providers/stt/whisper.py` remains as a fallback when `WHISPER_API_KEY` is set and ElevenLabs is not.
- `providers/llm/anthropic_provider.py` uses the official Anthropic SDK with `base_url` pointed at CliProxy.
- `providers/audio/suno.py` defaults to `sunoapi.org` (`/api/v1/generate` + `/api/v1/generate/record-info`). When a template has reference tracks, it uses `upload-extend` with the first resolved reference clip; local `/refs/*` files are uploaded to Suno's temporary file storage first because external Suno cannot fetch `127.0.0.1`.
- `api/refs/` contains public 60-second reference clips. Full local source tracks belong in ignored `api/reference-sources/`.
- `POST /suno/callback` is a no-op webhook target for providers that require a callback URL while the API still polls for completion.
- `providers/blob/filesystem.py` is the local dev store mounted at `/blob`; `providers/blob/s3.py` is intentionally still a stub until the R2 bucket is provisioned.

## Layout

See `docs/plans/2026-05-03-meditation-generation.md` for the full implementation plan and `docs/plans/2026-05-03-meditation-infra.md` for the deployment / provisioning doc.
