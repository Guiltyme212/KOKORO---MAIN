# Kokoro Native

React Native (Expo SDK 56) port of the Kokoro 3.0 web frontend. See
[`../../docs/rn-port-spec.md`](../../docs/rn-port-spec.md) for the full port
plan and architectural decisions.

## Stack

- Expo Router (file-based routing under `app/`)
- React Native 0.85, React 19
- **uniwind** (Tailwind for RN) with HeroUI Native primitives
- React Query (server state, persisted to AsyncStorage)
- Zustand (client state, persisted to AsyncStorage)
- `@elevenlabs/react-native` for the conversational agent
- expo-audio (player) + expo-video (mascot videos)
- expo-apple-authentication (Apple Sign In)
- jest-expo + @testing-library/react-native + fast-check

## DDD layout

```
src/
├── domain/          pure TypeScript — types, rules, value objects
├── application/     use cases + port interfaces
├── infrastructure/  HTTP, NDJSON, storage, native adapters
└── presentation/    components, screens, RQ hooks, Zustand stores, theme
```

Layer rules: `domain` imports nothing; `application` imports only `domain`;
`infrastructure` implements `application/ports`; `presentation` composes
everything via `src/presentation/queries/composition-root.ts`.

## Run

```bash
# from repo root
pnpm install

# native dev (Expo)
pnpm -F native dev

# iOS (requires Xcode on macOS):
pnpm -F native ios
# Android:
pnpm -F native android
```

Default API base is `http://localhost:8787`. Override with
`EXPO_PUBLIC_API_BASE`.

## Test

```bash
pnpm -F native test        # jest
pnpm -F native check-types # tsc --noEmit
```

98 tests across the domain, application, infrastructure, and component
layers. Live screens (chat, player, video mascot) are exercised in the
iOS simulator since their native modules aren't safe to instantiate under
jest.

## Configuration

- `EXPO_PUBLIC_API_BASE` — backend URL (default `http://localhost:8787`).
- `expo-apple-authentication` requires the App Store Connect entitlement;
  Apple Sign In falls back to a friendly error on devices without it.
- Backend `ClientInfo.source` now accepts `"native"` (in
  `apps/api/src/kokoro_api/types.py`).

## Library backend

RN uses a local-only AsyncStorage library (no Telegram user ID required).
Multi-device sync is a deferred follow-up — see the spec for options
(Apple user ID via backend change vs. ephemeral device UUID).
