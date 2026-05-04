# Handoff: Kokoro App — onboarding & ritual flow

## Overview
Kokoro is a mobile meditation/journaling app where the user briefly captures what they're carrying, picks a mode (tone) for the meditation, and gets a personalized 90-second ritual. This handoff covers the full 8-screen flow from first launch to reflection, plus a Library of saved meditations.

## About the design files
The files in this bundle are **design references created in HTML/JSX** — prototypes that show the intended look and behavior, **not production code to copy directly**. The task is to recreate these designs in the target codebase's environment (React Native, SwiftUI, Flutter, web React, etc.), using its established patterns and component library. If no environment exists yet, pick the best framework for a mobile-first app (recommended: React Native + Reanimated, or SwiftUI for iOS-first).

`index.html` is the runnable prototype; open it in a browser to see the live flow with restart and screen counter at the bottom.

## Fidelity
**High-fidelity.** Final colors, typography scale, spacing, animations, and interactions are all locked. Reproduce pixel-perfectly using the target codebase's primitives. Copy text is final.

---

## Design system

### Tokens

```
/* Color */
--bg               #0a0807   /* deep ink, near-black */
--ink              #f3ece3   /* warm paper text */
--ink-soft         rgba(243,236,227,.7)
--ink-muted        rgba(243,236,227,.5)
--ink-faint        rgba(243,236,227,.14)
--primary          #e25a36   /* warm orange (orb, CTA) */
--primary-dim      #c84c2b
--primary-soft     #f4a06b   /* light orange for accents (eyebrow, accent words) */

/* Type */
--font-serif       Cormorant Garamond, Garamond, "Times New Roman", serif
--font-mono        IBM Plex Mono, "JetBrains Mono", monospace
--font-cjk         "Noto Serif JP", "Yu Mincho", serif

/* Radii */
--r-card           18px
--r-pill           999px

/* Easing */
--ease             cubic-bezier(.22, 1, .36, 1)

/* Shadow / glow */
glow-warm:         0 0 24px -8px rgba(225,118,68,.6)
glow-strong:       0 0 32px -6px rgba(225,118,68,.6)
```

See `kit.css` and `v2.css` for the full source.

### Typography roles
- **`h-mega`** — italic serif, ~36px, weight 400, line-height 1.1, `text-wrap: balance`. Headline on every primary screen. One word in the headline is colored `--primary-soft` (`#f4a06b`) as the accent.
- **`prose-large`** — serif italic, ~22px, line-height 1.45. For the Mirror reflection prose. Inline `<span class="emph">` highlights words in `--primary-soft`.
- **`Eyebrow`** (custom) — IBM Plex Mono, 10px, weight 600, letter-spacing 0.24em, uppercase, color `--primary-soft`. Always rendered as `— Word` with an em-dash prefix.
- **`whisper`** — serif italic, 14px, ink-muted. Quiet supporting copy.
- **`footer-mono`** — Plex Mono, 10px, letter-spacing 0.16em, uppercase, ink-muted.

### Core components

- **`Aurora`** — full-screen background of three slow-drifting warm radial gradients (~30s loop). On every screen except where noted. See `ScreensV2.jsx`.
- **`BreathOrb`** — large central kanji glyph (`心`) with a 5.5s ease-in-out scale+opacity breathing animation (`@keyframes breath`). Used on Welcome and (dimmed) on Composing/Player/Mirror/Reflect.
- **`CtaBig`** — full-width orange gradient pill button, 56px tall, fixed at `bottom: 32px`, label is mono uppercase 10px with letter-spacing 0.24em.
- **`← Back` (`lnk-soft`)** — top-left, 32px from edges, transparent, mono caps. No `TopRow` chrome.
- **Save pill** — top-right rounded pill, 8×14 padding, mono caps `♡ save` → `♥ saved`. Used on Player and Reflect. When saved: warm orange gradient bg, white-ish text, soft glow. See exact spec under "Save / library pattern" below.

### Animations
- Fade-in container (`.fade-in`): 0→1 opacity, 0.4s ease.
- Stagger (`.stagger`): children fade up 12px, 80ms cascade.
- Breath (`@keyframes breath`): scale 0.95 → 1.05 over 5.5s, ease-in-out, infinite.
- Aurora gradient drift: ~30s linear loop, transform-only.
- Composing dot loader: 3 dots, 1.4s pulse, 0.18s stagger.

---

## Flow & screens

The full flow is **Welcome → Capture → Mode → Name → Mirror → Composing → Player → Reflect → (loop back to Welcome)**. Library is reachable from Welcome's heart icon (top right) and shows saved meditations.

### 1. Welcome
**Purpose:** First impression. Sets brand tone (calm, intimate, sacred).
**Layout:**
- KOKORO wordmark — top center, 36px from top, italic serif 22px, letter-spacing 0.4em.
- Library button — top-right circle (44×44), faint border, ♥ glyph in `--primary-soft`, red badge with count "3".
- Center: large breathing `心` orb with warm orange glow (`BreathOrb`).
- Headline: `h-mega` "Breathe out. **I'm here.**" (last 2 words `--primary-soft`).
- Whisper subtitle: "90 seconds. One ritual. Just for tonight."
- `CtaBig`: "Begin".

**Actions:** Begin → Capture; ♥ → Library.

### 2. Capture
**Purpose:** User says/types/taps what they're carrying.
**Layout:**
- Aurora background.
- Back button top-left.
- Eyebrow: "— Capture".
- Headline: "What are you **carrying?**".
- Center: `MicVisualiser` — large pulsing circle with mic icon, click to start/stop recording (timer counts up while active).
- Above CTA: tab control "Speak / Type / Tap" — pill segmented control.
- `CtaBig`: "Continue".

**Actions:** Tap mic toggles recording; tabs switch input mode (visual only); Continue → Mode.

### 3. Mode
**Purpose:** Choose the tone of voice for the meditation.
**Layout:**
- Aurora background.
- Back button top-left.
- Headline: `h-mega` "How should it **hit?**".
- Vertical stack of 5 large mode cards (~104px tall), each with its own emotional skin (these are intentionally distinct — the variety is the point):
  1. **Raw** — pale green `#dfe6dc` bg with red gradient blob. "Arial Black" headline. Glyph: `!?`.
  2. **Cosmic** — deep purple radial bg with star-dot pattern. Gold accents. Glyph: `✦`.
  3. **Iron** — near-black with red left-border (4px) and faint scanlines. Impact font. Glyph: `力`.
  4. **Zen** — cream `#f4ecd8` bg, all serif italic black ink. Glyph: `無`.
  5. **Sleep** — midnight blue gradient with starfield + soft moon glow on right. Glyph: `夢`.
- When one is selected: it lifts + scales (`translateY(-3px) scale(1.02)`) with a warm orange ring; the other 4 dim to 45% opacity + desaturated. A `✓` badge appears top-right.
- `CtaBig`: "Compose for me".

**Actions:** Tap card to select. Selection persists. CTA → Name (passing the mode).

### 4. Name
**Purpose:** Pick how the user wants to be addressed in the meditation.
**Layout:**
- Aurora.
- Back top-left.
- Eyebrow: "— Name" in `--primary-soft`.
- Headline: `h-mega` "What should I **call you?**" (`call you?` is `--primary-soft`).
- Whisper sub: "Not your username. The name that lands when someone says it softly."
- Names are tactile chips (pill shape, 8×14 padding, faint border). Selected chip: warm orange gradient bg + glow.
- The set of names changes by mode (e.g., raw → "Bestie / Bro / Real one"; zen → "Friend / Stranger / 君"; sleep → "Dreamer / Star / Sleepy one").
- "+ Your own" chip opens a text input.
- `CtaBig`: "Continue".

**Actions:** Pick a chip or type custom. Continue → Mirror.

### 5. Mirror
**Purpose:** Show that the system "heard" the user — reflective prose.
**Layout:**
- Aurora background.
- Dim breathing `感` kanji center (opacity ~0.16).
- Back top-left.
- Eyebrow: "— Mirror".
- Headline: `h-mega` "What I **heard.**"
- `prose-large` paragraph: "You are not being dramatic. You are carrying **anger, pressure,** and the feeling that nobody really saw how much **effort** you put in **today**." (bold words wrapped in `<span class="emph">` — italic, `--primary-soft`).
- Below prose: mono caps "Did I hear you?" with a short divider line.
- `CtaBig`: "Yes — compose for me".

**Actions:** Continue → Composing.

### 6. Composing
**Purpose:** Loading state — system "shapes" the ritual.
**Layout:**
- Aurora.
- Big breathing `心` in center, ~240px, `--primary` color, 0.55 opacity, soft 60px orange glow.
- Eyebrow at top: "— Composing".
- Italic serif sub: "shaping your ritual…".
- Bottom: 3-dot loader, warm orange, 1.4s pulse with 0.18s stagger.
- Auto-advances after 2.2s.

**No user input.**

### 7. Player
**Purpose:** Plays the generated meditation.
**Layout:**
- Aurora.
- Back top-left.
- Big breathing `心`, `--primary`, 0.42 opacity, slow breath.
- Top-center: eyebrow "— for {name}" (e.g., "— for Sweetheart"), then `h-mega` headline "You did **enough** today." (`enough` is `--primary-soft`).
- **Save pill** top-right: `♡ save` → `♥ saved` (matches Reflect; persists into Library).
- Scrubbable progress bar near bottom (4px tall, warm-orange filled portion, 14px draggable thumb with white core + orange ring). Time labels mono, 11px, letter-spacing 0.12em.
- Play controls bottom-center: ⏮ skip-back, large 72px circular play/pause (warm gradient + glow), "End" link → loops to Welcome.

**Actions:** Tap mic glyph circle to play/pause; drag/click bar to scrub; ♥ to save (independent action); End → Welcome.

### 8. Reflect
**Purpose:** Quiet check-in after the ritual.
**Layout:**
- Aurora + dim breathing `心` center (0.18 opacity).
- Back top-left.
- Save pill top-right.
- Eyebrow: "— Reflect".
- Headline (italic serif, 32px, **not** `h-mega` — quieter): "How does it feel,\nright **now?**" (`now?` is `--primary-soft`).
- Mono sub: "Did it land?" with letter-spacing 0.16em.
- Two italic-serif text-button links side by side: "yes" / "not quite". Selected: full ink color; unselected: ink-soft.
- Bordered 18px-radius card near bottom: italic placeholder "a word, a feeling…" + mic glyph on right.
- Below card: 6 italic-serif word chips (`lighter`, `steady`, `tired`, `clear`, `softer`, `still`). Selected word colors `--primary`.
- Tiny mono link: "Close · 心" to loop back to Welcome (instead of a `CtaBig` — the screen is intentionally quieter).

**Actions:** Tap yes/not quite (independent state); tap a word chip; tap Close → Welcome.

### Library (off-flow, opens from Welcome ♥)
**Purpose:** Saved meditations, kept on device.
**Layout:**
- Aurora.
- Back top-left.
- Eyebrow: "— Library".
- Headline: `h-mega` "Yours, **kept.**"
- Italic serif sub: "{n} meditations · saved on this device".
- Vertical stack of cards using the **same `mode-tile` skin system as the Mode picker** — each saved meditation keeps its mode's color/typography (zen card looks zen, raw card looks raw). Each card shows: glyph, mode tag, title, "for {name} · {duration} · {date}", and a small ▶ play indicator.
- Empty-state hint at bottom: dashed border, italic serif "tap ♥ on any meditation to keep it here".

**Actions:** Tap a card → Player (replays); Back → previous screen.

---

## Save / library pattern (cross-screen contract)

The save pill is **the same component** on Player and Reflect, and the result feeds the Library:

```
Position: top: 28px; right: 28px; z-index: 6
Padding: 8px 14px
Border-radius: 999px
Font: IBM Plex Mono, 10px, 600, letter-spacing 0.18em, uppercase
Layout: flex, gap: 6px
Heart glyph: 13px

Default:
  border: 1px solid rgba(243,236,227,.14)
  background: rgba(243,236,227,.04)
  color: ink-soft
  glyph: ♡  /  text: "save"

Saved:
  border: 1px solid transparent
  background: linear-gradient(180deg, #e25a36, #c84c2b)
  color: #fff8ef
  shadow: 0 0 16px -4px rgba(225,118,68,.6)
  glyph: ♥  /  text: "saved"

Transition: all .25s var(--ease)
```

When saved on Player or Reflect, the meditation persists with its mode skin in the Library list. The Library item card is the same `mode-tile` component as on the Mode-pick screen — mode/skin is the persistent identity of a meditation.

---

## State

- `mode`: "raw" | "cosmic" | "iron" | "zen" | "sleep" — picked on Mode, used on Name, Composing, Player, and stamped onto saved Library items.
- `name`: string — picked on Name, displayed in Player eyebrow.
- `recording`: bool — Capture mic state.
- `seconds`: number — Capture recording timer.
- `playing` / `progress`: Player playback state.
- `saved` (per item) — heart toggle state on Player and Reflect.
- `land`: "yes" | "not quite" | null — Reflect feeling.
- `word`: string | null — Reflect chosen word.
- `library`: array of saved meditations (mode, glyph, title, name, duration, date).

The Welcome → Reflect → Welcome loop should reset the per-session state but keep `library` and `mode` (the latter as a soft default).

---

## Files
- `index.html` — runnable prototype shell with FLOW array and the simple linear router.
- `Components.jsx` — v1 shared primitives (`TopRow`, `Eyebrow`, `Cta`, `Chip`, `Tabs`, `MicVisualiser`, `KanjiBg`).
- `Screens.jsx` — v1 screens (Capture, Mirror, Composing, Player, Library) + dead `ScreenWelcome` / `ScreenName` / `ScreenShape` / `ScreenReflect` that are *not* in the final flow but referenced from `_dev.html`.
- `ScreensV2.jsx` — final-flow screens (`ScreenWelcomeV2`, `ScreenModeV2`, `ScreenNameV2`, `ScreenReflectV2`) plus shared visuals (`Aurora`, `BreathOrb`, `CtaBig`).
- `kit.css` — base tokens, typography, primitives.
- `modes.css` — older mode-card skins (referenced by `ScreenShape`).
- `v2.css` — Aurora, breath orb, mega-headline, mode-tile skins (current), feel-buttons, save-pill, ripple.

The active screens used in `index.html`'s FLOW are:
1. `ScreenWelcomeV2`
2. `ScreenCapture` (Screens.jsx)
3. `ScreenModeV2`
4. `ScreenNameV2`
5. `ScreenMirror` (Screens.jsx)
6. `ScreenComposing` (Screens.jsx)
7. `ScreenPlayer` (Screens.jsx)
8. `ScreenReflectV2`
+ `ScreenLibrary` (Screens.jsx, off-flow).

Older v1 versions are kept in source for reference but should not be ported.

## Assets
- All glyphs are unicode CJK characters (`心`, `感`, `無`, `夢`, `力`) — no external font assets required beyond Noto Serif JP.
- Fonts: Cormorant Garamond (serif), IBM Plex Mono (mono), Noto Serif JP (CJK). Use the codebase's existing font-loading pattern.
- No raster images, icons, or illustrations are used. All glow/aurora/orb effects are CSS gradients + transforms.
