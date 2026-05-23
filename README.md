# Kokoro

> The personalized meditation app that talks to you by name.

Current frontend work is the Kokoro 3.0 cream/moss/mustard migration: a companion-style ElevenLabs chat that can trigger one personalized meditation generation from inside the conversation. Incoming agents should read `CLAUDE.md` and `docs/plans/HANDOFF-2026-05-16-kokoro-3.md` before changing the visual system.

Voice-first AI meditations. Every meditation addresses the user by a chosen pet name. The current build targets web, Telegram Mini App, and the Capacitor iOS App Store shell from one frontend.

## Repository layout

- [BUSINESS.md](BUSINESS.md) - product strategy, positioning, MVP scope, personas.
- [apps/web/](apps/web/) - Vite + React + TypeScript frontend. Doubles as the Telegram Mini App.
- [apps/native/](apps/native/) - Expo + React Native port. See [docs/rn-port-spec.md](docs/rn-port-spec.md).
- [apps/api/](apps/api/) - Python 3.12 + FastAPI backend for `/meditations`.
- [templates/](templates/) - JSON meditation skeletons used by the backend selector.
- [docs/plans/HANDOFF-2026-05-16-kokoro-3.md](docs/plans/HANDOFF-2026-05-16-kokoro-3.md) - current Kokoro 3.0 handoff for future agents.
- [docs/rn-port-spec.md](docs/rn-port-spec.md) - React Native port spec (uniwind + React Query + DDD).

## Dev

Run the API first:

```sh
cd apps/api
cp .env.example .env
uv sync --all-extras
uv run uvicorn kokoro_api.main:app --reload --port 8787
```

Then run the frontend:

```sh
cd apps/web
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build → apps/web/dist/
```

Or run the React Native port (Expo):

```sh
pnpm install      # at repo root
pnpm dev:native   # Expo dev server
pnpm -F native ios  # iOS simulator (requires macOS + Xcode)
```

Set `VITE_API_BASE=http://localhost:8787` for local frontend builds if you do not want the default.

The frontend works in plain browsers and inside Telegram WebView. Telegram-specific calls (haptics, header colour, etc.) no-op outside Telegram via [`isInTelegram()`](apps/web/src/lib/telegram.ts).

## Kokoro 3.0 notes

The active frontend flow is:

`welcome -> name -> feeling -> source -> promise -> chat -> player/home/library`

The design source lives in `Kokoro Design System (2)/kokoro-3-0/project/`. The Kokoro MP4s are not truly transparent; their cutout effect uses an opaque cream background, `mix-blend-mode: multiply`, and wrapper masks. See `CLAUDE.md` and the May 16 handoff before changing the visual system.

ElevenLabs agent chat uses a backend-issued private conversation token. Configure `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, and `ELEVENLABS_BRANCH_ID` in environment only; never commit keys.

## Speech-to-text

Kokoro 3 uses the ElevenLabs conversation flow in [`apps/web/src/screens/Kokoro3.tsx`](apps/web/src/screens/Kokoro3.tsx). The older browser-native speech-to-text flow is archived in [`apps/web/archive/old-design/`](apps/web/archive/old-design/) and kept only as reference.

## Meditation generation

`POST /meditations` validates the user request, selects a template, asks Anthropic via CliProxy for a strict JSON script, sends the script to Suno through `sunoapi.org`, writes the MP3 and metadata to blob storage, and returns the signed `audioUrl` plus beat metadata for the player.

MVP voice presets are mock style hints in `apps/api/src/kokoro_api/providers/audio/voice_presets.json`; no Suno persona uploads are required yet.
