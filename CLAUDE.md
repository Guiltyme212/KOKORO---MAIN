# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Three-tier repo:

- Root holds **`BUSINESS.md`** — product/positioning canon. Treat it as the source of truth for naming, copy, and scope. The root `README.md` is a templates spec that is misfiled here (per BUSINESS.md it should live at `templates/README.md`).
- **`app/`** — the Vite + React + TypeScript frontend. The same build serves plain browsers and the Telegram Mini App (the TG SDK is loaded unconditionally in `app/index.html`).
- **`api/`** — the Python 3.14 + FastAPI backend. Generates meditations end-to-end (capture → script → Suno audio → blob persistence). Its own README at [`api/README.md`](api/README.md) has the deeper provider/pipeline notes; `api/templates/` has the per-vibe Suno+writer templates checked into git.

## Commands

Frontend (from `app/` with pnpm):

```sh
cd app
pnpm install
pnpm dev          # Vite dev server, http://localhost:5173
pnpm build        # tsc -b && vite build, output → app/dist/
pnpm lint         # eslint .
pnpm preview      # vite preview locally
pnpm start        # what Railway runs: vite preview --host 0.0.0.0 --port ${PORT:-4173}
```

Backend (from `api/` with uv):

```sh
cd api
uv sync --all-extras
uv run uvicorn kokoro_api.main:app --reload --port 8787   # dev API
uv run pytest                                              # unit tests
uv run ruff check && uv run mypy src                       # lint + types
```

`pnpm build` doubles as the frontend typecheck (`tsc -b` runs first). Backend has real pytest tests under `api/tests/`.

## Deployment

`main` auto-deploys to https://kokoro-main-production.up.railway.app/ via Railway (repo: `Guiltyme212/KOKORO---MAIN`, root dir `app/`). Railway runs `pnpm install && pnpm build` then `pnpm start`. `app/vite.config.ts` sets `preview.allowedHosts: true` so Railway's reverse-proxy hostnames pass — don't tighten that without giving Railway an explicit allowlist.

The API is a separate Railway service (`api/railway.json` config, root dir `api/`). It runs uvicorn on `${PORT}` and the frontend reaches it via the `VITE_API_BASE` env var (default `http://localhost:8787` in dev). CORS allow-list is the `CORS_ORIGIN` env var (comma-separated origins).

## Architecture

### Screen flow and routing

The app is a linear 8-screen ritual loop driven by a hash-based router:

`welcome → name → capture → mirror → contentType → composing → player → reflect`

- `app/src/lib/router.ts` — `useRouter()` reads/writes `window.location.hash`, debounces transitions by 320ms (matches the page-wrap exit animation in `App.css`), and exposes `goto(route)`. Routes are a closed union; unknown hashes fall back to `welcome`.
- `app/src/App.tsx` is the only place screens are mounted. It maps each route to a screen component in the `SCREENS` record. The four "companion" routes (`home`, `library`, `quickReset`, `sleep`) are stubs pointing to `Welcome` until they are built.
- `app/src/components/Jumper.tsx` is a dev-only numbered jump bar (01–08) that lets you skip to any screen — handy when iterating on a screen mid-flow.
- Every screen receives `{ goto }` and calls `goto('nextRoute')` to advance. There is no router context and no nested routes.

### State

A single global store: `app/src/state/answers.ts`.

- Module-level mutable `state: Answers`, mirrored to `localStorage` under the key `kokoro_answers`. Subscribers fire via React's `useSyncExternalStore`.
- Public API: `useAnswers()` hook for components, `answersApi` (`set`, `reset`, `getSnapshot`) for non-component code. Per-key updates only; there is no batched/multi-key setter.
- Shape lives in `app/src/types.ts`. `Mode`, `ContentType`, `VoiceId`, `Becoming` are all closed string unions — when adding a new option, extend the union there or things will silently typecheck against `''`.

### Telegram integration

`app/src/lib/telegram.ts` is the single boundary.

- The TG SDK auto-installs `window.Telegram.WebApp` even in a plain browser, so **never** check `window.Telegram?.WebApp` directly — use `isInTelegram()` (which checks `initData` is non-empty). All haptic/header/MainButton calls go through the `safe()` wrapper so they no-op silently outside Telegram and on older TG clients.
- `initTelegram()` is called once from `App.tsx` on mount.

### Speech-to-text

`app/src/lib/stt.ts` wraps the browser-native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Used by the Capture (03) and Reflect (08) screens. `createStt()` returns an inert `{ isSupported: false }` handle when the API is missing — callers are expected to check that and fall back to text input rather than guarding upstream.

### Visuals and design tokens

- `app/src/styles/tokens.css` defines the canonical palette (`--sumi #0a0908`, `--washi #f4efe6`, `--persimmon #c84c2b`, `--graphite`, `--stone`) and font stacks (Fraunces serif, Geist sans, Noto Serif JP for kanji, JetBrains Mono for eyebrows). Fonts are loaded from Google Fonts in `app/index.html`. **Use these tokens, not raw hex** — and keep persimmon to ≲10% of any screen.
- `app/src/components/atoms.tsx` exports the shared visual primitives (`Glow`, `TopBar`, `Eyebrow`, `Display`, `Btn`). Reach for these before adding new typography/layout. Hard rules from BUSINESS.md: no gradients beyond the `Glow` atom, no shadows beyond the device frame and the `Btn` persimmon glow, no emoji, no exclamation points, sentence case, kanji always has a referent.
- `DeviceFrame` wraps every screen in a phone-shaped surface so the layout is the same in browser and Telegram. Screens position themselves with `position: absolute; inset: 0;` inside this frame.

### Naming gotcha

The Kokoro 2.0 design prototype uses older terms (`Aftercare/Future Self/Lock In`, "skin"). BUSINESS.md is newer and renames these to **Unwind / Attract / Lock In** and "content type" — the code follows BUSINESS.md (`ContentType` union is `'unwind' | 'attract' | 'lockin'`). When porting copy from the prototype, translate the names.

### Meditation generation pipeline (frontend ↔ backend)

The `Composing` screen calls **`POST /meditations/stream`** (NDJSON streaming response — primary path) and reads three event types as they arrive:

1. `script` (~20–45s in) — LLM has finished generating the personalized lyrics.
2. `streaming` (~30–90s in) — Suno's `streamAudioUrl` is now populated; the Composing screen advances to Player and starts playing this URL immediately. **This is the audio the user hears first.**
3. `ready` (~90–180s in) — Suno's final mastered audio has been downloaded and persisted to the BlobStore; the Save-to-library button unlocks.

Implementation:

- `app/src/lib/api.ts` — `generateMeditationStreaming(input)` is an async generator that fetches the endpoint and yields each NDJSON line as a typed `StreamEvent`. The legacy `generateMeditation()` (single-shot `POST /meditations`) is kept for tests/scripts.
- `app/src/screens/Composing.tsx` — for-await loop over the stream. Advances to Player on `streaming`. Drain continues after navigation so the persisted `audioUrl` lands in the store and the Save button unlocks.
- `app/src/screens/Player.tsx` — `<audio src>` is **frozen at first render** via `useMemo([], …)` so the later `ready` event doesn't yank playback mid-listen. The Save button is disabled until `generated.audioUrl` (the persisted blob URL) is set.
- `app/src/state/generatedMeditation.ts` — single-record sessionStorage-backed store. Holds both `streamAudioUrl` (early, Suno CDN) and `audioUrl` (persisted blob). Exposes `set()` and `update(partial)` for the merge-on-`ready` step.

Backend pipeline lives in `api/src/kokoro_api/pipeline/` — see `api/README.md` for the deeper notes (two-phase Suno polling, reference-upload cache, writer auto-coercer).

### Companion routes still unimplemented

The four "companion" routes (`home`, `library`, `quickReset`, `sleep`) are stubs pointing to `Welcome`. The "continuity engine" ("yesterday you told me…") is in copy/spec but not in state. Don't invent integration plumbing for these without asking — scope is intentionally still on the visual ritual.
