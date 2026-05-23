# Kokoro RN — Quality-of-Life Spec

> Companion to [`docs/rn-port-spec.md`](rn-port-spec.md). Lists everything between "the ritual flow works" and "ship to the App Store + delight the user."

## Context

The RN port at `apps/native/` walks the ritual end-to-end (welcome → chat → player → library) and 98 tests pass. It is feature-complete vs. apps/web, but **not** ready for App Store v1. Real-user gaps: no daily reminders even though the reminder-time field is collected, the screen lock kills playback because background audio isn't configured, no app icon, no privacy/terms screens, no Now Playing controls. This spec enumerates exactly what's needed to ship.

## Decisions

- **Target outcome**: App Store v1. Apple-reviewable polish (icon, splash, privacy, background audio) plus immediate-user-impact features (reminders, lock-screen controls).
- **Scope**: Tier 1 (must-ship) explicit + Tier 2 (strong nice-to-haves for v1.1) explicit + Tier 3 (named only, deferred).
- Per-phase commits, mirroring the RN-port convention.

## Tier 1 — required for App Store v1

| # | Feature | What it touches | Deps |
|---|---|---|---|
| 1 | App icon + splash | `assets/icon.png` (1024²), `assets/splash.png` (2732²), `app.json` (`icon`, `splash`, `ios.bundleIdentifier=com.kokoromind.app`, plugin), expo-splash-screen | `expo-splash-screen` |
| 2 | Background audio | `app.json` `ios.infoPlist.UIBackgroundModes: ["audio"]`, audio session category `playback`, Android foreground-service plugin | (in expo-audio) |
| 3 | Lock-screen / Now Playing | `setNowPlayingInfo` in `infrastructure/audio/expo-audio-player.ts` when loading; clear on unload | (in expo-audio) |
| 4 | Audio interruption handling | Pause on phone call / Siri / alarm via session config; resume after | (in expo-audio) |
| 5 | Daily reminder notifications | `infrastructure/notifications/expo-notifications.ts` + `application/use-cases/schedule-daily-reminder.ts`. Permission on Promise accept. Tap deep-links to `/chat`. | `expo-notifications` |
| 6 | Privacy + Terms screens | `app/legal/privacy.tsx` + `terms.tsx`. Linked from Settings + Welcome footer. | optional `react-native-markdown-display` |
| 7 | Settings screen | `app/settings.tsx` — reminder enable/time, sign-out, **delete-account** (Apple requires this), open privacy/terms, dev API base override. | — |
| 8 | Toast / error UI | `presentation/components/Toast.tsx` portal mounted in `_layout.tsx`. Replaces inline error patterns. | in-house |
| 9 | Onboarding skip when signed in | `(onboarding)/welcome.tsx`: if `auth.apple` + `persona.callMe` populated, `router.replace('/(tabs)/home')`. | — |
| 10 | Accessibility baseline | VoiceOver labels on every `Pressable`, dynamic-type allowance, `useReducedMotion` in `FadingBubble`/`RotatingName`, `accessibilityLiveRegion` on ChatBubble. | — |
| 11 | Crash reporting | `infrastructure/observability/sentry.ts` init in `_layout.tsx`, scrubs ElevenLabs tokens + audio URLs. Source maps via sentry-cli in EAS step. | `@sentry/react-native` |
| 12 | App lifecycle / state restore | `AppState` background → flush stores; foreground → reconcile in-flight phases (extend `rehydratePhase` to fire on resume). | — |
| 13 | App.json App Store metadata | `ios.bundleIdentifier`, `ios.buildNumber`, top-level `version`, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`. | — |

## Tier 2 — strong nice-to-haves for v1.1

| # | Feature | Notes |
|---|---|---|
| 14 | Sleep timer | 5/10/15/30 min auto-stop in player with audio fade-out. |
| 15 | Skip ±15s + playback speed | 0.75 / 1.0 / 1.25× in `expo-audio-player.ts` + `app/player.tsx`. |
| 16 | Offline audio cache | `expo-file-system` downloads on `ready` event; library + player prefer local file. |
| 17 | Localization en/ru | Backend already accepts `locale`. `expo-localization` + `i18n-js`, en/ru bundles, Settings toggle. |
| 18 | Dark mode | Tailwind `dark:` variants + `useColorScheme`; Settings override. |
| 19 | Pull-to-refresh | `RefreshControl` on Library + Home. |
| 20 | Deep linking | `kokoro://meditation/<id>` opens player; `kokoro://chat` opens chat. Notification taps route via deep links. |
| 21 | Share | Share-sheet from Player via `Share` API. |
| 22 | Analytics | PostHog. Events: onboarding completed, generation started/ready, library saved, app open. |
| 23 | Account management | Delete-account (Tier 1) + library JSON export (Tier 2). |
| 24 | Streaks + history viz | Persona gains `lastSession`, `streakDays`. Bar chart in Progress tab. |
| 25 | Offline banner | Wire `expo-network` to a top banner when offline. |

## Tier 3 — future, named only

26. Apple Watch companion.
27. iOS Home-Screen widget.
28. Siri shortcuts / App Intents.
29. Spotlight indexing of saved meditations.
30. Live Activities.
31. iCloud key-value backup of persona.
32. App Clips (try-Kokoro flow).
33. Multi-device library sync (Apple ID via backend — already flagged in `docs/rn-port-spec.md`).
34. Achievements / badges.
35. Social — share streaks, invite a friend.

## Implementation phasing

Per-phase commits, mirroring the RN-port convention.

- **QoL-0** Spec doc in repo + README pointer.
- **QoL-1** Branding — icon, splash, app.json metadata, expo-splash-screen wired.
- **QoL-2** Audio polish — background audio, Now Playing, interruption handling, sleep timer.
- **QoL-3** Notifications — daily reminders, permission on Promise, deep-link tap.
- **QoL-4** Settings + legal — Settings screen, privacy/terms, account-delete, API base override.
- **QoL-5** Error/lifecycle — toast host, AppState resume reconcile, onboarding skip.
- **QoL-6** Observability — Sentry init, PII scrub, PostHog + 5 core events.
- **QoL-7** Accessibility pass.
- **QoL-8** Player power features — skip ±15s, playback speed, offline cache.
- **QoL-9** Localization en/ru + dark mode.
- **QoL-10** Deep linking + share + offline banner + pull-to-refresh.
- **QoL-11** Streaks + history visualization.
- **QoL-12** Final polish + TestFlight smoke walk + spec status table updated.

## Verification

Real-iPhone TestFlight walk for Tier 1:

1. App launches with the Kokoro splash → onboarding.
2. Onboarding completes; daily reminder is scheduled (Settings → Notifications shows the entry).
3. Generate a meditation, play it, lock the phone → audio continues. Trigger an alarm → audio pauses, resumes after.
4. Tap the Now-Playing widget on lock screen → app foregrounds to the active player.
5. Force-quit during a stream → cold launch → that vibe is in `error` with a Retry button.
6. Settings → open privacy → markdown renders. Sign out → Welcome. Delete account → confirms then signs out.
7. Crash a screen on purpose → Sentry receives the event with no ElevenLabs token in breadcrumbs.

## Status

| Phase | Status | Commit prefix |
| --- | --- | --- |
| QoL-0 — spec doc | ✅ | `docs(rn): add Kokoro RN QoL spec` |
| QoL-1 — branding | ✅ | `feat(native): QoL-1 branding` |
| QoL-2 — audio polish | ✅ | `feat(native): QoL-2 audio polish — background, Now Playing, interruptions, sleep timer` |
| QoL-3 — notifications | ✅ | `feat(native): QoL-3 daily reminder notifications` |
| QoL-4 — settings + legal | ✅ | `feat(native): QoL-4 Settings + legal screens` |
| QoL-5 — error / lifecycle | ✅ | `feat(native): QoL-5 toast host, AppState resume, onboarding skip` |
| QoL-6 — observability | ✅ | `feat(native): QoL-6 Sentry + analytics scaffolding` |
| QoL-7 — accessibility | ✅ | `feat(native): QoL-7 accessibility baseline — reduced motion + chat live region` |
| QoL-8 — player power | ✅ | `feat(native): QoL-8 offline audio cache (expo-file-system)` |
| QoL-9 — i18n + dark mode | ✅ (partial) | `feat(native): QoL-9 localization + appearance preference` |
| QoL-10 — linking/share/offline | ✅ | `feat(native): QoL-10 share + offline banner + pull-to-refresh` |
| QoL-11 — streaks | ✅ | `feat(native): QoL-11 streaks + 7-day history viz on Progress tab` |
| QoL-12 — final polish | ✅ | `chore(native): QoL-12 verification + spec status` |

### Test + typecheck snapshot at QoL-12

- `pnpm -F native test` → **102 passing across 20 suites**.
- `pnpm -F native check-types` → clean.

### Known follow-ups (out of QoL phasing)

- **Dark-mode visual swap** — Tier 2 #18. The appearance preference
  ("auto" | "light" | "dark") is collected, persisted, and exposed via
  `useAppearance()`, but the actual token swap requires uniwind themes
  (light/dark CSS-variable bundles) which is a palette-wide refactor.
  Tracked here; v1.1.
- **Full string migration to i18n** — QoL-9 wired `t()` and migrated
  Settings + legal copy. The other screens still use English literals;
  swapping them is mechanical and incremental.
- **Sentry source maps in EAS** — the SDK is wired with PII scrubbing
  but the `sentry-cli upload-sourcemaps` step needs to land in the EAS
  build phase before production captures are useful.
- **PostHog reverse-proxy** — `EXPO_PUBLIC_POSTHOG_HOST` defaults to
  `us.i.posthog.com`; a CDN-cached origin avoids Apple's privacy
  manifest scrutiny.
- **Localized content (mascot voice, ElevenLabs dynamic vars)** — frontend
  ships en/ru wiring; agent content tasks live elsewhere.

## Risks / open questions

- **expo-notifications is local-only** — daily reminders here are scheduled locally; server-driven push needs APNs + a backend job, out of scope.
- **App Store privacy nutrition labels** — Apple requires declaring data collected (mic for voice, identifier for user account). The spec doc tracks the declarations; the runtime ports just need usage strings (already in Tier 1 #13).
- **Sentry source maps** — needs sentry-cli in the EAS build step; documented in `apps/native/README.md`.
- **Localization scope** — translating mascot voice / ElevenLabs agent dynamic vars to ru is an LLM/content task, not a frontend task. Frontend ships the en/ru wiring; content follows.
- **Account deletion** — Apple now requires in-app account deletion if you offer in-app account creation. Tier 1 #7 (Settings) must include a working delete path, even if it's a thin local + backend stub.
