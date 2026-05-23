# Kokoro RN Port — Implementation Spec

> Source of truth for the React Native port of the Kokoro 3.0 web frontend. The plan is executed phase-by-phase; each phase ends with its own commit.

## Context

The web app at `apps/web/` (Kokoro 3.0 — cream/moss/mustard ritual flow) is the source of truth. A barely-started Expo scaffold lives at `apps/native/` (Expo 56, Expo Router, RN 0.85, **uniwind**, HeroUI Native, Reanimated, ~5% complete: just a drawer + theme toggle, no features). The goal is porting the **entire** web frontend to React Native, keeping the existing **uniwind** Tailwind-for-RN setup and **HeroUI Native** primitives, using **React Query** as the data layer, **DDD layering**, and **tests that prove the port works**. We commit after every phase.

The web app is ~13 screens, 7 stores, NDJSON streaming generation, ElevenLabs voice agent, audio playback, video assets, dual library backends (Telegram + localStorage). The RN port targets native iOS (Expo prebuild → Xcode), with Android available via the same Expo project.

## Decisions

- **Library on RN**: local-only via AsyncStorage. Backend untouched. Multi-device sync deferred.
- **Apple Sign In**: included via `expo-apple-authentication`.
- **Mascot videos**: cream-on-cream pass-through, no asset re-encoding. Every screen background matches the video's cream bg.
- **Styling**: keep existing **uniwind** (Tailwind v4 for RN) and **HeroUI Native** primitives.
- **Server state**: React Query + AsyncStorage persistence.
- **Client state**: Zustand (one store per domain concept, mirroring the web's `useSyncExternalStore` stores).
- **Tests**: `jest-expo` + `@testing-library/react-native` + `msw` (HTTP mocks).

## Target architecture (DDD layering)

All RN source lives under `apps/native/src/`. Expo Router screens in `apps/native/app/` are thin — they pull from `presentation/` and do nothing else.

```
apps/native/
├── app/                          (Expo Router — thin screen files)
│   ├── _layout.tsx               (QueryClientProvider, fonts, gesture root, HeroUI provider)
│   ├── (onboarding)/{welcome,name,feeling,source,promise}.tsx
│   ├── (tabs)/{home,library,progress,you}.tsx + _layout.tsx
│   ├── chat.tsx
│   ├── player.tsx
│   ├── quick-reset.tsx
│   └── sleep.tsx
└── src/
    ├── domain/                   (pure TS — no React, no RN imports)
    │   ├── meditation/{vibe, capture, generate-meditation,
    │   │              stream-event, vibe-cards, we-can-phrase,
    │   │              provider-meta}.ts
    │   ├── persona/persona.ts
    │   ├── answers/answers.ts
    │   ├── library/library-item.ts
    │   ├── auth/auth.ts
    │   └── pipeline/{phase, transitions}.ts
    ├── application/              (use cases — orchestrate domain + ports)
    │   ├── ports/                (interface contracts)
    │   └── use-cases/
    ├── infrastructure/           (adapters)
    │   ├── http/{client, ndjson-stream}.ts
    │   ├── api/{meditations, elevenlabs, library, uploads}.ts
    │   ├── storage/...
    │   ├── audio/expo-audio-player.ts
    │   ├── haptics/expo-haptics.ts
    │   └── auth/expo-apple-auth.ts
    └── presentation/
        ├── components/
        ├── screens/
        ├── queries/              (React Query hooks)
        ├── state/                (Zustand stores)
        └── theme/{tokens, fonts}.ts
```

**Layer rules:**
- `domain/` imports: nothing.
- `application/` imports: `domain/` only.
- `infrastructure/` imports: `domain/` + `application/ports/`.
- `presentation/` imports: anything.

## Critical web → RN mappings

| Web | RN equivalent |
|---|---|
| `localStorage` / `sessionStorage` | `@react-native-async-storage/async-storage` |
| `window.location.hash` router | Expo Router |
| `@elevenlabs/react` | `@elevenlabs/react-native` |
| `<video>` + `mix-blend-mode` | `expo-video` (cream-on-cream pass-through) |
| HTML `<audio>` | `expo-audio` |
| `fetch` streaming NDJSON | XHR-based chunk reader |
| Capacitor Apple Sign In | `expo-apple-authentication` |
| Capacitor / TG Haptics | `expo-haptics` |
| Web Speech API | Not ported (ElevenLabs handles voice) |
| Telegram integration | Dropped on RN; `client.source = 'native'` |
| CSS safe-area | `react-native-safe-area-context` |
| `visualViewport` | `react-native-keyboard-controller` |

The backend `ClientInfo.source` discriminator gets `'native'` added in Phase 3.

## Phase plan

### Phase 0 — Sync repo + write the spec

Working tree committed, spec doc in `docs/rn-port-spec.md`, pointer in root README. Commit `docs(rn): add Kokoro RN port spec`.

### Phase 1 — Foundation

uniwind palette in `tailwind.config`, install React Query / Zustand / Expo modules / @elevenlabs/react-native, jest-expo setup, DDD scaffold, `_layout.tsx` with `QueryClientProvider` + `HeroUINativeProvider` retained, delete starter drawer demo files, smoke test. Commit `feat(native): foundation`.

### Phase 2 — Domain layer

Pure-TS types and rules ported from `apps/web/src/types.ts` / `lib/types-meditation.ts` / `screens/Kokoro3.tsx` (`VIBE_CARDS`, `buildWeCanPhrase`) and web stores' invariants (`addTheme`, `recordMeditation`). Full unit tests. Commit `feat(native): domain layer`.

### Phase 3 — Infrastructure

HTTP client, XHR-based NDJSON stream, storage repos, API clients, native adapters (audio/haptics/auth). Backend `client.source` discriminator gains `'native'`. msw-based HTTP tests, byte-level NDJSON tests, storage round-trips. Commit `feat(native): infrastructure`.

### Phase 4 — Application + state + RQ hooks

Use cases: `kickoff-meditation`, `save-to-library`, `list-library`, `upload-capture`, `sign-in-with-apple`, `start-voice-session`. Zustand client stores (persisted). React Query hooks. Use-case tests with fake ports. Commit `feat(native): application use cases + state stores + RQ hooks`.

### Phase 5 — Design system + components

Theme tokens, fonts, assets migration. Reusable components built on HeroUI Native (`Button`, `Surface`) where they fit; custom `KokoroMascot`, `VideoPeek`, etc. Component tests. Commit `feat(native): design system`.

### Phase 6 — Onboarding flow

`(onboarding)/{welcome,name,feeling,source,promise}`. Apple Sign In wired. Tests. Commit `feat(native): onboarding flow`.

### Phase 7 — Chat + ElevenLabs

`app/chat.tsx` + sub-components (`MessageList`, `StylePicker`, `InputBar`, `MascotStage`). `@elevenlabs/react-native` `useConversation` wired with dynamic vars + client tools. Picking a style kicks off generation. Tests. Commit `feat(native): Chat + ElevenLabs`.

### Phase 8 — Player + Home + Library

`expo-audio` player with seek; tab navigator; Home3 + Library3. Tests. Commit `feat(native): Player, Home, Library`.

### Phase 9 — Remaining screens + polish

`quick-reset.tsx`, `sleep.tsx`, `(tabs)/progress.tsx`, `(tabs)/you.tsx`. Haptics, keyboard handling, safe-area, iOS sim smoke test. Tests. Commit `feat(native): aux screens + polish`.

### Phase 10 — Verification + docs

Full test/lint/typecheck/iOS-sim verification, update this spec with results, `apps/native/README.md`, root README pointer. Commit `chore(native): verification + docs`.

## Testing strategy

Test runner: `jest-expo`.

- `domain/`: 100% lines achievable, no async, no IO. `fast-check` property tests for cap+dedupe invariants.
- `application/`: dependency-injected ports → easy fakes. Cover happy / retry / idempotency / error.
- `infrastructure/`:
  - HTTP via `msw` v2 server in `jest.setup.ts`.
  - Storage via the official AsyncStorage jest mock.
  - Expo modules mocked manually in `__mocks__/`.
  - NDJSON parser has dedicated byte-level fixtures (mid-line splits, trailing partial, error events).
- `presentation/`: component snapshot + a11y tests via `@testing-library/react-native`. Screen tests render with a test `QueryClientProvider`.

Mocks centralised at `apps/native/__mocks__/`.

## Verification

At the end of Phase 10:

1. `pnpm install` at repo root succeeds.
2. `pnpm -F native test` all suites green.
3. `pnpm -F native lint && pnpm -F native check-types` clean.
4. API up locally + `pnpm -F native ios` (sim) walks the ritual end-to-end.

## Risks / open questions

- **NDJSON streaming on RN**: XHR-based reader works universally but a native module fallback is on the table if device perf suffers.
- **Backend `source: 'native'`**: tiny Pydantic Literal change in `apps/api/src/kokoro_api/types.py`, applied in Phase 3.
- **`@elevenlabs/react-native` parity** with `@elevenlabs/react`: SDK shapes are very close; if `clientTools` registration differs, fall back to handling tool intents via `onMessage`.
- **Fonts**: M PLUS Rounded 1c is freely licensed.
- **Mascot video file size**: ~25–40MB bundled initially; CDN lazy-loading is a follow-up.
