# Kokoro Design System

> 心 · the heart‑mind · 夢 · the dream

**Kokoro** is a guided‑meditation ritual delivered as a Telegram Web App. The user opens it inside Telegram, names how they want to be addressed, speaks (or types) what they're carrying, and Kokoro mirrors it back, composes a personalised meditation in one of three "shapes" (Unwind / Attract / Lock In), reads it in a chosen voice, and invites a short reflection. Sessions are private by default and can be saved to a Library bound to the user's Telegram account.

The product is intentionally slow, ceremonial and intimate. The design language borrows from East Asian calligraphy and printed devotional books — large kanji glyphs as ambient art, italic serif headlines, mono uppercase for system labels, warm low‑light palette, single primary action per screen.

## Sources

| Source | Access | Notes |
| --- | --- | --- |
| `Guiltyme212/KOKORO---MAIN` (GitHub) | **Not accessible** to this design agent — the GitHub App is not installed on the `Guiltyme212` account. | Install at https://github.com/apps/claude-design-import/installations/new and re‑run to upgrade tokens & components from inferred to source‑of‑truth. |
| `screenshots/` (9 PNGs) | ✅ Local mounted folder, copied into `screenshots/` | Welcome, Name, Capture, Mirror, Content Type, Composing, Player‑empty, Reflect, Library. |
| Figma | None provided | — |

> ⚠️ **All tokens, components and copy in this system are reverse‑engineered from screenshots.** Where exact values were sampled (background, primary orange, body gray) they are accurate. Where they were inferred (spacing scale, full radius set, hover states, fonts) they are flagged in `colors_and_type.css` and below. Please confirm or replace before shipping.

## Product surfaces

| # | Screen | Step indicator | Purpose |
| --- | --- | --- | --- |
| 01 | Welcome | `01` orange | "What is your kokoro holding?" — entry, three‑pillar meaning (Heart / Mind / Spirit), Begin / No story / Library |
| 02 | Name | `02` orange | "What should I call you?" — soft pet‑name picker (Love, Babe, Honey, Baby, Sweetheart, Sunshine, Kitten…) |
| 03 | Capture | `03` orange | "Tap to begin when you're ready" — voice / type / tap input, mic visualiser, timer |
| 04 | Mirror | `05` orange | "You are not being dramatic. You are carrying anger, pressure…" — Kokoro reflects; emphasis words italicised in orange |
| 05 | Shape & Voice | `04` orange | Three meditation shapes (Unwind, Attract, Lock In) + four voices (Mira, Brad, Aiko, Sage) |
| 06 | Composing | `06` orange | Heart kanji breathing, error fallback "Something broke upstream." |
| 07 | Player (empty) | `07` orange | "No meditation yet." — Compose one CTA |
| 08 | Reflect | `08` orange | "How does it feel, right now?" — yes / not quite, word picker (lighter, steady, tired, clear, softer, still), close + voice |
| — | Library | Hairline | "Library is bound to your Telegram account." — saved meditations |

The 8‑pip stepper at the top is **always visible**; the active step is a filled orange capsule, the rest are mono numerals on a dark hairline pill.

---

## Content fundamentals

**Voice:** second‑person intimate. Kokoro speaks _to_ you, never about you. It uses "you" constantly and never says "I" except as the user's pet‑name proxy ("What should I call you?"). It is ceremonial but plain — no jargon, no spiritual cliché, no "vibes". It uses long, calm sentences punctuated by short ones.

**Tone:** soft, certain, slightly literary. Like a person who has been waiting for you. Never coaches, never sells, never asks for permission twice.

**Casing rules:**
- **Mono UPPERCASE** with letter‑spacing for system labels, step indicators, eyebrows, micro‑copy: `WELCOME`, `STAY A MOMENT`, `READY WHEN YOU ARE`, `OR SOMETHING SOFTER`, `TAKES 90 SECONDS · PRIVATE`.
- **Italic serif sentence‑case** for headlines and prose: _What is your kokoro holding?_, _Tap to begin when you're ready._
- **Buttons** are uppercase mono with wide tracking: `BEGIN`, `CONTINUE`, `COMPOSE MY MEDITATION`. Secondary buttons are italic serif sentence‑case: _Compose one_, _Try again_.
- **Em‑dashes wrap eyebrows**: `— WELCOME —`, `— MIRROR —`, `— STAY A MOMENT —`.
- **Middle dots** separate metadata: `01 · WHAT YOU'RE CARRYING`, `TAKES 90 SECONDS · PRIVATE`, `EN · soft`.

**Emphasis:** key emotional words inside body prose are coloured in primary orange and stay italic — _"You are carrying **anger, pressure,** and the feeling that nobody saw how much **effort** you put in **today**."_

**Pet names** appear as soft chips: Love, Babe, Honey, Baby, Sweetheart, Sunshine, Kitten. There is always an "+ YOUR OWN" escape hatch and a mono "SKIP FOR NOW" — Kokoro never traps the user.

**No emoji.** Not in copy, not in UI. The brand uses kanji glyphs and the heart‑logomark instead.

**Specific examples** (verbatim from screenshots):

> — WELCOME —
> _What is your **kokoro** holding?_
> Speak it, type it, or just let go. We'll build tonight's ritual around it.

> Not your username. The name that lands when someone says it softly.

> — MIRROR —
> _You are not being dramatic. You are carrying **anger, pressure,** and the feeling that nobody really saw how much **effort** you put in **today**._
> — DID I HEAR YOU?

> _Soft. Like talking to someone who gets it._
> Warm voice, slow pace, room to feel. ~6 min.

> _Cinematic. Rehearse the life you're building._
> Narrated scene from your near‑future. Vivid, calm, identity‑shaping. ~7 min.

> _Direct. Mental reps for discipline._
> Sharp voice, intense pace, no negotiation with the weaker version of you. ~4 min.

> _Something broke upstream._
> Try again

> _No meditation yet._
> Compose one

> — STAY A MOMENT —
> _How does it feel, right now?_
> DID IT LAND?     yes   not quite

---

## Visual foundations

### Palette
Sampled directly from the screenshots:

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0a0908` | Page background, near‑black, slightly warm |
| `--bg-glow` | radial `#27130d` → `#0a0908` | Soft warm vignette behind central content on most screens |
| `--ink` | `#f3ece3` | Headline serif text on dark |
| `--ink-soft` | `#b8aea5` | Body, descriptive prose |
| `--ink-muted` | `#7a716a` | Mono labels, inactive step pips, fine print |
| `--ink-faint` | `#3a322d` | Hairlines, kanji watermark glyphs at low opacity |
| `--primary` | `#c84c2b` | Active step pip, primary CTA fill, emphasis words, accent underline |
| `--primary-hot` | `#e25a36` | Primary CTA hover / pressed highlight |
| `--primary-dim` | `#7a3520` | Outline of selected cards, secondary primary uses |
| `--success` | `#7a9b6a` | (Inferred) confirmation, only used sparingly |
| `--danger` | `#b04a3c` | Error states ("Something broke upstream.") — same family as primary, slightly redder |

### Typography
Two families do almost all the work:

- **Display / headline / body prose** — high‑contrast italic serif. Likely **GT Sectra** or **Domaine Display** in production. _Substituted with Google Fonts **Cormorant Garamond** (italic) — flag for replacement._
- **System / labels / buttons** — fixed‑width mono with wide tracking. Likely **JetBrains Mono** or **Berkeley Mono**. _Substituted with Google Fonts **JetBrains Mono**._
- **Kanji glyphs** — system CJK fallback (`"Noto Serif JP"`, `"Hiragino Mincho Pro"`). Always rendered at very low opacity as ambient watermark.

Type ramps and the full spec live in `colors_and_type.css`.

### Backgrounds
Almost every screen uses the same recipe:
1. Solid `--bg` base.
2. A soft, off‑centre **radial glow** in `--bg-glow` behind the active content block. The glow is _below_ the heart‑kanji watermark.
3. Large kanji characters — 感 (feel), 思 (think), 光 (light), 道 (way), 志 (will), 静 (still), 夢 (dream), 未 (not‑yet) — placed at the page edges, very low opacity (`~6%`), italic serif weight, never centred behind copy.
4. The **heart‑kokoro logomark** (心) is the centred breathing watermark on Capture, Composing and Player‑empty screens.

No gradients beyond the radial glow. No textures. No noise.

### Animation
- **Breathing** — the centre kanji on Composing & Player scales `1 → 1.04 → 1` over ~6s, ease‑in‑out, infinite.
- **Mic capture** — concentric ring waveform around the mic, animates outward as audio levels change.
- **Step pip** — when advancing, the next pip's number fades to white, then the orange capsule slides in (~250ms ease‑out).
- **Page transitions** — fade + 8px y‑translate, ~300ms, ease‑out. Never slide horizontally.
- **Buttons** — primary fill brightens to `--primary-hot` on hover (~120ms), scales `0.98` on press (~80ms).
- **Text reveal on Mirror** — words appear in batches with a 60ms stagger so reading feels paced, not dumped.

Easing default: `cubic-bezier(0.22, 1, 0.36, 1)` (a soft "ease‑out‑expo"). Avoid bouncy, springy, or overshoot easings.

### Hover & press states
- **Primary CTA** — fill `--primary` → `--primary-hot` on hover; scale `0.98` and inner shadow on press.
- **Secondary chip** (pet names, Reflect words) — outline `--ink-faint` → `--primary-dim`; text `--ink-soft` → `--ink`. No fill on hover. Selected state: 1px `--primary-dim` outline + faint `--primary` glow, text in `--ink`.
- **Card** (Shape options) — selected state: 1px `--primary` border, faint warm radial glow behind the card, glyph in `--primary`. Unselected: 1px `--ink-faint` border, glyph in `--ink-muted`.
- **Mono link** (BACK, LIBRARY, NO STORY · JUST RESET ME, SKIP FOR NOW): underline appears on hover; tap state lowers opacity to 0.6.

### Borders, radii, shadow
- **Hairline** — 1px solid at `--ink-faint` for everything that needs an edge but not attention.
- **Capsule** — fully rounded (radius = height/2). Used on the step indicator, primary CTAs, secondary chips. _Capsule is the dominant shape language._
- **Card radius** — `20px` (Shape options, Voice tiles).
- **Input radius** — `999px` (capsule). Inputs are full pill, never square.
- **Shadows** — almost none. Selection uses a faint warm glow (`box-shadow: 0 0 24px -8px rgba(200,76,43,0.35)`) instead of a hard drop shadow. There is _one_ inner shadow on the primary CTA on press, otherwise the system is shadow‑free.

### Protection vs capsules
This system uses **capsules**, not protection gradients. Text never sits over a photographic image, so no scrim is required. The only "protection" pattern is the dark base with the radial glow softening the centre — and even that is decorative, not protective.

### Layout
- Mobile‑first, designed at **440px wide** (matches the screenshots — Telegram WebApp viewport).
- Fixed top: 8‑pip step indicator, 24px from top, centred.
- Below the pip: a mono row with `← BACK` (left) and `01 · CURRENT STEP` (centred or right) at 56px from top.
- Content vertically lives roughly `120px–700px`; primary CTA is **anchored bottom**, full‑width capsule, 32px side margin, 32px from bottom.
- Outer side margin is **32px**. Content max‑width on tablet/desktop should remain ~440px — Kokoro is intentionally portrait‑locked.

### Transparency & blur
- The kanji watermarks sit at `opacity: 0.06–0.12` over the bg.
- The Reflect overlay raises a translucent panel from the bottom — `rgba(10,9,8,0.92)` with **no blur** (the bg is already near‑black).
- No frosted‑glass effects. No backdrop‑filter. Kokoro is matte.

### Imagery
There are no photos in the product. The only "imagery" is:
- Kanji characters as ambient watermarks.
- The heart logomark (a hand‑drawn 心 stylised) used both as wordmark companion and as the breathing centre on Composing/Player screens.
- Glyphs on Shape cards: 心 (Unwind / heart), 未 (Attract / not‑yet), 志 (Lock In / will).

Color vibe: **warm, dim, intentionally underexposed.** Think candle‑light, not screen‑light.

### Cards
- 20px radius.
- 1px hairline border in `--ink-faint`.
- Background: same as page (`--bg`) — selection state turns on a faint inner radial glow rather than changing fill.
- Padding: 20px 24px.
- Title (italic serif), short eyebrow above (mono), body sentence below (sans‑mono `--ink-soft`).

### Spacing scale
4px base. Tokens: `--s-1: 4px`, `--s-2: 8px`, `--s-3: 12px`, `--s-4: 16px`, `--s-5: 24px`, `--s-6: 32px`, `--s-7: 48px`, `--s-8: 64px`. The two values used most often are 16 (within‑group) and 32 (between groups / page side margin).

---

## Iconography

Kokoro is **glyph‑first, icon‑second.** Most "iconography" in the product is actually CJK characters used semantically:

| Glyph | Meaning | Where it appears |
| --- | --- | --- |
| 心 | heart / kokoro / Unwind | Logomark, Unwind shape card, Composing/Player breathing centre |
| 感 | feel | Welcome ambient, Mirror background |
| 思 | think | Welcome ambient |
| 光 | light | Welcome ambient |
| 道 | way / path | Welcome ambient |
| 志 | will / spirit / Lock In | Welcome pillars, Lock In shape card |
| 静 | stillness | Welcome ambient |
| 夢 | dream | Wordmark line ("夢 · THE HEART‑MIND") |
| 未 | not‑yet / Attract | Attract shape card |

These are typeset, not drawn. Use a Japanese serif (`Noto Serif JP` or system CJK serif) and render them at low opacity for ambient, full opacity for active card glyphs.

**Functional icons** are extremely rare — only:
- `🎤` mic — but rendered as a stroked SVG, not the emoji. (Capture screen.)
- `▶` play — small triangle inside a circle on Voice tiles and Reflect "speak" affordance.
- `+` plus — used in `+ YOUR OWN` chip.
- `←` left chevron — used in `← BACK`.
- `·` middle dot — separator, used everywhere.

**There is no icon font, no Lucide, no Heroicons in evidence.** Functional icons are hand‑authored SVGs at 1.5px stroke, rounded caps and joins, sized 16–24px, coloured `currentColor`.

If extending the system, **prefer adding a kanji glyph over inventing a Western glyph**. If you must add a Western icon, match Lucide's geometry (1.5px stroke, 24px box, rounded line caps) — the closest CDN match — and flag the substitution.

No emoji are ever used in the brand. Unicode characters that _are_ used: `·` (U+00B7), `—` (U+2014), `←` (U+2190), CJK characters listed above.

---

## Index — what's in this folder

| Path | What |
| --- | --- |
| `README.md` | (this file) |
| `colors_and_type.css` | All design tokens — palette, type ramp, semantic vars, radii, spacing, shadows |
| `fonts/` | Web font files (Cormorant Garamond, JetBrains Mono — substitutions, see `fonts/README.md`) |
| `assets/` | Logomark, kanji glyph specimens, icon SVGs |
| `preview/` | Design‑system preview cards (Type, Colors, Spacing, Components, Brand) |
| `ui_kits/app/` | Telegram WebApp UI kit — interactive click‑through of the 8‑step flow |
| `SKILL.md` | Cross‑compatible skill manifest for Claude Code |
| `screenshots/` | Source screenshots used to derive this system |

## Caveats / what to verify

- ✋ **Codebase not imported.** Tokens/fonts/components are inferred. If you can install the GitHub App on `Guiltyme212`, I can replace inferred values with source‑of‑truth in one pass.
- ✋ **Fonts are Google Fonts substitutes.** Cormorant Garamond ↔ likely GT Sectra / Domaine. JetBrains Mono ↔ likely Berkeley Mono. Please share the real font files.
- ✋ **Hover/press states are inferred** from common conventions for this aesthetic — please confirm against the live build.
- ✋ **No backend, no real audio, no Telegram bridge** in the UI kit — buttons advance state, that's it.
