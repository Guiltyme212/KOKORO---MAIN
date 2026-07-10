# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Critical iOS voice warning — May 22 2026

Before touching iOS voice, ElevenLabs connection settings, Capgo updater behavior, or native `AVAudioSession` code, read:

- `docs/ios-elevenlabs-audio-troubleshooting.md`

The current iPhone issue is an intermittent Capacitor/WKWebView audio-route problem, likely involving iOS output routing and sometimes the ear speaker/receiver. Safari and Telegram can work perfectly while the iOS app clips or loses initial audio. Do not treat `connectionDelay: { ios: 1500 }` as the old good baseline, do not switch WebRTC while still using `signedUrl`, do not re-add a broad app-launch `AVAudioSession` override, and do not trust tests unless logs show the `com.kokoromind.app` built-in bundle rather than a Capgo-downloaded bundle.

## Capgo/TestFlight OTA rule — May 23 2026

Before archiving for TestFlight/App Store, keep `app/capacitor.config.ts` `plugins.CapacitorUpdater.autoUpdate` set to `true`, then run `cd app && pnpm build && pnpm exec cap sync ios`. `directUpdate: false` is intentional: OTA bundles download on launch and apply after background/restart instead of reloading during a voice session. Use `cd app && pnpm run release:ota` for JS/CSS/copy/design fixes on the `production` channel after the native build with Capgo is installed. Do not use OTA for new native capabilities, entitlement changes, payments, or material new app functionality that should go through App Review.

## Current status — Kokoro 3.0 integration, May 16 2026

The active frontend is now the **Kokoro 3.0 cream/moss/mustard design**, not the older dark/orange ritual described in some older docs below.

Source-of-truth design handoff:

- `Kokoro Design System (2)/kokoro-3-0/project/Kokoro Welcome Screen.html`
- `Kokoro Design System (2)/kokoro-3-0/project/tokens.css`
- `Kokoro Design System (2)/kokoro-3-0/project/assets/`

When matching visuals, copy the CSS mechanics from `Kokoro Welcome Screen.html` first. Do not eyeball positions from screenshots unless the prototype is missing the screen.

### Active 3.0 frontend flow

`welcome -> name -> feeling -> source -> promise -> chat -> player/home/library`

Implementation lives mostly in:

- `app/src/screens/Kokoro3.tsx`
- `app/src/styles/kokoro3.css`
- `app/public/kokoro3/`
- `app/src/App.tsx`
- `app/src/lib/router.ts`

Legacy route names still exist for compatibility, but most map into the 3.0 flow. The old dark/orange screens are parked in `app/archive/old-design/` and are outside the active build.

### ElevenLabs agent + generation flow

Kokoro 3.0 uses an ElevenLabs conversational agent in the chat screen.

- Frontend SDK: `@elevenlabs/react`.
- Token fetcher: `app/src/lib/elevenlabs.ts`.
- Backend token route: `api/src/kokoro_api/routes/elevenlabs.py`.
- Backend config: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_BRANCH_ID`, `ELEVENLABS_ENVIRONMENT`.
- Current agent ID: `agent_3101krqbh19mezt9t835q2f7s5ds`.
- Current branch ID: `agtbrch_8101krqbh39jefytppvjqqth40c5`.
- Never commit or print the API key. It belongs only in local/Railway env.

Meditation generation still uses the existing backend `/meditations/stream` API. The old `kickoffAllMeditations()` behavior generated all five vibes at once; Kokoro 3.0 should instead start **one selected vibe** from inside chat via `kickoffMeditationFor(vibe, answers, null)`.

Style selection is not gone. It is shown inside chat as five style cards:

- `raw` / Gen Z
- `cosmic` / Spiritual
- `iron` / Drive
- `sleep` / Wind down
- `zen` / Zen

### Video transparency gotcha

The Kokoro MP4s are **not truly transparent**. They are regular rectangular MP4s on a cream background. The cutout effect only works when all of these are true:

- The immediate screen/background is opaque cream.
- The `<video>` has `mix-blend-mode: multiply`.
- The wrapper has both `-webkit-mask-image` and `mask-image`.
- The `<video>` includes `autoplay loop muted playsinline`.

For peeking videos, keep the structure close to:

```tsx
<div className="k3-peek-wrap k3-peek-wrap--right">
  <video autoPlay loop muted playsInline>
    <source src="/kokoro3/kokoro-peak.mp4" type="video/mp4" />
  </video>
</div>
```

The mask belongs on the wrapper; `mix-blend-mode` belongs on the child video. This is important for browser compositing. If a box appears, first compare against the original `.peek-wrap`, `.peek-wrap--right`, `.kokoro-stage`, and `kokoro-slot` CSS in `Kokoro Welcome Screen.html`.

### Verification snapshot

Recent checks:

- `cd app && pnpm build` passes.
- `cd app && pnpm lint` passes.
- `cd api && uv run pytest tests/routes/test_elevenlabs.py` passes.
- Changed backend route/config ruff + mypy checks pass.

Known unrelated test caveat: full `uv run pytest` currently fails during collection because `api/tests/pipeline/test_validate_lyrics.py` imports `validate_meditation_output`, which no longer exists.

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

`app/src/lib/stt.ts` wraps the browser-native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). It is legacy support from the older UI; Kokoro 3 currently uses the ElevenLabs conversation flow in `app/src/screens/Kokoro3.tsx`. `createStt()` returns an inert `{ isSupported: false }` handle when the API is missing.

### Visuals and design tokens

- The active production UI is Kokoro 3: `app/src/screens/Kokoro3.tsx` plus `app/src/styles/kokoro3.css`.
- The older black/orange UI has been moved out of the active source tree to `app/archive/old-design/`. It is kept intentionally for reference; do not use those files unless you are intentionally restoring that interface.
- `app/src/styles/tokens.css` still provides base tokens used by the app shell. Kokoro 3 defines its cream, moss, mustard, and sunset palette in `kokoro3.css`.

### Naming gotcha

The archived Kokoro 2.0 design prototype uses older terms (`Aftercare/Future Self/Lock In`, "skin"). Do not port that copy into Kokoro 3 unless the product direction explicitly asks for it.

### Meditation generation pipeline (frontend ↔ backend)

Kokoro 3 starts generation from the chat screen through `kickoffMeditationFor()` / `kickoffAllMeditations()`, which call **`POST /meditations/stream`** (NDJSON streaming response — primary path) and read three event types as they arrive:

1. `script` (~20–45s in) — LLM has finished generating the personalized lyrics.
2. `streaming` (~30–90s in) — Suno's `streamAudioUrl` is now populated and the chat can open the Kokoro 3 player. **This is the audio the user hears first.**
3. `ready` (~90–180s in) — Suno's final mastered audio has been downloaded and persisted to the BlobStore; the Save-to-library button unlocks.

Implementation:

- `app/src/lib/api.ts` — `generateMeditationStreaming(input)` is an async generator that fetches the endpoint and yields each NDJSON line as a typed `StreamEvent`. The legacy `generateMeditation()` (single-shot `POST /meditations`) is kept for tests/scripts.
- `app/src/state/meditationProgress.ts` — stream orchestration and per-vibe progress state.
- `app/src/screens/Kokoro3.tsx` — chat, style cards, player, home, and library screens for the active UI.
- `app/src/state/generatedMeditation.ts` — single-record sessionStorage-backed store. Holds both `streamAudioUrl` (early, Suno CDN) and `audioUrl` (persisted blob). Exposes `set()` and `update(partial)` for the merge-on-`ready` step.

Backend pipeline lives in `api/src/kokoro_api/pipeline/` — see `api/README.md` for the deeper notes (two-phase Suno polling, reference-upload cache, writer auto-coercer).

### Companion routes still unimplemented

The four "companion" routes (`home`, `library`, `quickReset`, `sleep`) are stubs pointing to `Welcome`. The "continuity engine" ("yesterday you told me…") is in copy/spec but not in state. Don't invent integration plumbing for these without asking — scope is intentionally still on the visual ritual.
