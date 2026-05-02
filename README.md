# Kokoro

> The personalized meditation app that talks to you by name.

Voice-first AI meditations. Every meditation addresses the user by a chosen pet name. Two tonal modes (soft / sharp), three content types (心 Unwind / 未 Attract / 志 Lock In). Web + Telegram Mini App first; iOS App Store later.

## Repository layout

- [BUSINESS.md](BUSINESS.md) — product strategy, positioning, MVP scope, personas. Source of truth for product decisions.
- [app/](app/) — Vite + React + TypeScript frontend. Doubles as the Telegram Mini App.
- `templates/` — meditation structural skeletons (sourcing rules in [templates/README.md](templates/README.md)). Not yet populated.

## Dev

```sh
cd app
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build → app/dist/
```

The frontend works in plain browsers and inside Telegram WebView. Telegram-specific calls (haptics, header colour, etc.) no-op outside Telegram via [`isInTelegram()`](app/src/lib/telegram.ts).

## Speech-to-text

Capture (screen 03) and Reflect (screen 09) use the browser-native Web Speech API for transcription — see [`app/src/lib/stt.ts`](app/src/lib/stt.ts). Falls back to text input where unsupported.

## Pre-launch

This is pre-launch MVP scaffolding. Audio generation (Suno / ElevenLabs) and LLM script generation are unimplemented — the player simulates playback with a ticking timer for now.
