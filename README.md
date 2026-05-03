# Kokoro

> The personalized meditation app that talks to you by name.

Voice-first AI meditations. Every meditation addresses the user by a chosen pet name. Two tonal modes (soft / sharp), three content types (心 Unwind / 未 Attract / 志 Lock In). Web + Telegram Mini App first; iOS App Store later.

## Repository layout

- [BUSINESS.md](BUSINESS.md) - product strategy, positioning, MVP scope, personas.
- [app/](app/) - Vite + React + TypeScript frontend. Doubles as the Telegram Mini App.
- [api/](api/) - Python 3.12 + FastAPI backend for `/meditations`.
- [templates/](templates/) - JSON meditation skeletons used by the backend selector.

## Dev

Run the API first:

```sh
cd api
cp .env.example .env
uv sync --all-extras
uv run uvicorn kokoro_api.main:app --reload --port 8787
```

Then run the frontend:

```sh
cd app
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build → app/dist/
```

Set `VITE_API_BASE=http://localhost:8787` for local frontend builds if you do not want the default.

The frontend works in plain browsers and inside Telegram WebView. Telegram-specific calls (haptics, header colour, etc.) no-op outside Telegram via [`isInTelegram()`](app/src/lib/telegram.ts).

## Speech-to-text

Capture (screen 03) and Reflect (screen 09) use the browser-native Web Speech API for transcription - see [`app/src/lib/stt.ts`](app/src/lib/stt.ts). The backend also has ElevenLabs Scribe first and Whisper fallback for future voice upload flows, but the current frontend sends captured speech as text.

## Meditation generation

`POST /meditations` validates the user request, selects a template, asks Anthropic via CliProxy for a strict JSON script, sends the script to Suno through `sunoapi.org`, writes the MP3 and metadata to blob storage, and returns the signed `audioUrl` plus beat metadata for the player.

MVP voice presets are mock style hints in `api/src/kokoro_api/providers/audio/voice_presets.json`; no Suno persona uploads are required yet.
