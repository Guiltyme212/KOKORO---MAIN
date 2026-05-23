# Kokoro — Business Document

> The personalized meditation app that talks to you by name.
> Living document. Source of truth for product, positioning, and MVP scope.

---

## 1. What Kokoro is

Kokoro is a voice-first meditation app that generates personalized audio meditations on demand. **Every meditation addresses the user by a chosen pet name** (зай, котёнок, brother, king, legend, by first name) — this is non-negotiable, not a setting. It is the central differentiator and the reason the product feels personal in a way no competitor does.

The product is built around **moments, not a content library**. Three moments anchor the experience:

- **Morning** — set state for the day (ritual)
- **Evening** — release the day (decompression)
- **Right now** — situational, on-demand (the wedge)

The architecture has two layers:

### Two modes (tonal register)

The mode is set in onboarding and changeable in settings. It controls voice cast, copy register, and prompt tone. It does NOT change what meditations are available.

- **Soft mode** — warm, validating, gentle. Female narrators, lower-register men. Pet names like *зай, котёнок, sweet one*. Default for emotionally-led users (the Liz persona).
- **Sharp mode** — direct, grounded, focused. Confident male narrators, lower-register women. Pet names like *brother, king, legend, champ*. Default for performance-led users (the McKinsey-friend persona).

Both modes use pet names. The men are not less hungry for personalization — they want a different register of it.

### Three content types (what the meditation does)

These exist in both modes. The content type is chosen by the user (or inferred from the moment) every session.

- **心 Unwind** — process what already happened. Sit with the day, release what you carried. The brand layer references the kokoro-as-vessel metaphor (*"What is your kokoro holding tonight?"*); the user-facing label is the simple, immediately-readable verb Unwind. Evening-coded by default but available anytime.
- **未 Attract** — cinematic visualization of who you're becoming. A scene from your future life, narrative and immersive. Morning-coded by default. Works in both modes (soft: the calm life you're building; sharp: the empire you're running).
- **志 Lock In** — commit to a state in the next hour. Short, sharp, command-driven. Pre-pitch, pre-workout, before a hard conversation, deep work block. Available anytime, situational by nature.

This collapses the earlier three-skin model into something cleaner: **modes change *how* it sounds; content types change *what it does.*** Unwind and Lock In are mechanically opposite (releasing vs committing). Attract sits between them and works in either register.

Generation is powered by Suno (audio) plus a language model (script). Templates from existing high-quality meditations seed the model with structure and pacing.

---

## 2. The insight

The opportunity comes from one specific custdev conversation (Liz, daily Meditopia user) and supporting evidence from other users we know.

**What current meditation apps get wrong:**
- They open as a content marketplace. The user has to browse to find what fits the moment.
- The narrator is fixed. Liz literally abandoned other apps because the voice didn't work for her.
- The app addresses "you" generically. There is no personalization beyond a name field.
- The structure is library-first. The "right now I feel terrible" moment is poorly served by scrolling.

**What Liz actually does and values:**
- Has a daily ritual (morning program, evening release).
- Most days, knows what she wants to hear before opening the app.
- Sometimes (the rarer case) can't name the feeling and scrolls until something fits — the **ASAP moment**.
- Values: the narrator's voice, breadth of catalog, the "understanding atmosphere" — she compared it to talking to ChatGPT.
- She quoted ChatGPT addressing her as *"котёнок"*. The pet name is what made her feel seen.

**The four wedges that follow from this:**

1. **Pet-name personalization is non-negotiable and woven into every meditation.** This is the single biggest differentiator competitors cannot match without rebuilding their content pipeline. Women especially want to be addressed by something chosen for them — it's how the app delivers the feeling of being seen. Men want it too, in a different register (*brother, king, legend*). The pet name is not a setting; it is the product.
2. **Voice-first capture** ("speak what's going on, get a meditation back") solves the ASAP moment that current apps handle by making users browse.
3. **Continuity across sessions** — every meditation knows what came before. *"Yesterday you set an intention around focus — let's build on that."* Static-library apps cannot do this.
4. **Editorial design language** — the category looks like a dental office. Kokoro looks like Aesop. Brand premium without expensive content production.

---

## 3. Target customers

Three personas, served by the same product through the mode toggle (soft / sharp) and the three content types (Unwind / Attract / Lock In).

### Persona A — Liz (soft mode, default)

- Woman, 25–35, urban, knowledge worker.
- Daily Meditopia / Calm / Headspace user.
- Uses meditation for emotional regulation, not just sleep or focus.
- Talks to ChatGPT for emotional support between therapy sessions.
- Values: warm voice, validation language ("you're allowed to feel this"), program structure, range of topics.
- Frequency: daily, sometimes multiple times a day.
- Willingness to pay: high (already paying Meditopia).
- Primary content types: **Unwind** (evening processing), occasional **Attract** (calm life she's building).

### Persona B — The McKinsey friend (sharp mode)

- Man, 25–40, ambitious professional or founder.
- Does power poses in the bathroom before high-stakes meetings.
- Reads productivity content, listens to Huberman, lifts weights.
- Probably does NOT identify as a "meditation" user — would call it "mental reps" or "locking in."
- Values: discipline framing, no-fluff direct language, performance outcomes, being addressed as *brother / king / legend*.
- Frequency: situational (pre-event), aspirationally daily (morning routine).
- Willingness to pay: very high if framed as performance, not wellness.
- Primary content types: **Lock In** (situational), **Attract** (the future he's building).

### Persona C — The visualizer (cross-mode)

- Either gender, ambitious, future-oriented.
- Already does vision-board / manifestation / morning visualization.
- Wants the cinematic 7-minute "scene from your future life" content.
- Overlaps with both Persona A (women in soft mode wanting an aspirational morning) and Persona B (men in sharp mode wanting future-state commitment).
- Primary content type: **Attract**, in either mode.

**Do not split the brand for these personas.** One app, two modes (soft / sharp), three content types available in both. Splitting at MVP kills focus and doubles acquisition cost.

---

## 4. Positioning vs competitors

| | Meditopia | Calm | Headspace | Kokoro |
|---|---|---|---|---|
| Content model | Pre-recorded library | Pre-recorded library | Pre-recorded library | **Generated on demand** |
| Personalization | None beyond name | None | None | **Pet name + situation + history** |
| Wedge | Sleep stories | Celebrity narrators | Founder brand | **Voice-first capture + AI** |
| Tone | Therapeutic-soft | Premium-glossy | Friendly-corporate | **Editorial-premium-warm** |
| Continuity | Programs (linear) | None | Courses | **Adaptive across sessions** |
| Voice flexibility | Single narrator per track | Single narrator | Single narrator | **User picks voice + can change** |

Kokoro's positioning sentence:

> *"Meditations made for you, by name. The app that talks to you the way ChatGPT does — but in a voice you actually want to fall asleep to."*

---

## 5. Market context

- Global meditation app market is multi-billion and growing. Calm and Headspace are the giants; Meditopia is the strong regional player (especially Turkey, MENA, parts of Europe).
- Meditopia reportedly does meaningful eight-figure annual revenue based on public reporting and app intelligence estimates — exact numbers shift; treat as directional.
- The category has been static on product innovation for ~5 years. Generative AI changes the unit economics of content (no studio, no narrators on payroll, infinite catalog) AND the personalization ceiling (every meditation is unique).
- This is a window. Once Calm or Headspace ships AI-generated meditations, the differentiator becomes harder. Speed matters.

**Realistic growth trajectory for an MVP-to-product play in this space:**

- Months 0–3: MVP, voice-quality validation, 50–200 manually-recruited users (Hacker House network, custdev contacts).
- Months 3–6: First public launch, organic TikTok/Reels driven by the "vent → personalized meditation" hook. Realistic target: 5k–20k installs if one piece of content goes mid-viral.
- Months 6–12: Paid acquisition begins to make sense if D7 retention >25% and conversion to paid >3%. Target: 50k–150k installs, 1.5k–5k paying subscribers.
- Year 2+: Scale depends entirely on retention metrics. The category supports $50–80 ARPU annually for paying users. 10k paying subscribers = $500k–$800k ARR. 50k = $2.5M–$4M ARR.

These are not promises. They are the shape of plausible outcomes if execution is good and the wedge works. The single biggest variable is whether AI-generated voice retains users at acceptable rates compared to professional narrators.

---

## 6. MVP scope

**Goal:** Ship a working app that lets a user open it, speak about their day, and receive a personalized audio meditation in under 30 seconds. Every meditation addresses the user by their chosen pet name. Validate retention with 50–200 users before scaling.

The detailed in/out feature list lives elsewhere and evolves as the design ships. This document holds the principles, not the screen inventory.

### Tech stack

- **Audio generation:** Suno. Tested, sounds great, ready for MVP.
- **Script generation:** the best available language model. Templates from `templates/` seed the prompt with structure and pacing.
- **Voice:** Suno's voice models. ElevenLabs as fallback if a specific narration voice is needed on top of Suno's musical bed.
- **Backend:** thin API that takes `{user_context, pet_name, mode, content_type, situation, history}` and returns an audio URL.
- **Frontend:** native preferred for audio quality and the breathing animations; React Native acceptable if it ships faster.
- **Storage:** each user's meditation history (what was generated, what they tagged, what worked). This is the continuity engine.

---

## 7. Content templates strategy

**The problem:** LLMs alone do not write good meditations. Pacing, breath cues, sentence rhythm, and silence placement all matter, and the model needs examples.

**The solution:** seed every generation with a template. Templates are transcribed from high-quality meditations on YouTube (Tara Brach, Sarah Blondin, Jay Shetty, free Calm content, Insight Timer top-rated tracks). They're structural skeletons, not content to copy verbatim.

**Suggested repo structure:**

```
kokoro/
├── BUSINESS.md                    ← this file
├── README.md                      ← technical setup
├── apps/
│   ├── web/                       ← frontend
│   └── api/                       ← backend
├── prompts/                       ← LLM prompts per mode × content type × moment
│   ├── soft_hold.md
│   ├── soft_see.md
│   ├── soft_lock_in.md
│   ├── sharp_hold.md
│   ├── sharp_see.md
│   ├── sharp_lock_in.md
│   ├── instant.md                 ← voice-capture flow, mode-aware
│   └── continuity.md              ← cross-session memory injection
├── templates/                     ← transcribed meditation skeletons
│   ├── unwind/                    ← processing, releasing, sitting with
│   ├── attract/                   ← cinematic visualization
│   ├── lock_in/                   ← commit to a state, performance
│   ├── breathwork/                ← pure breathing protocols (Quick Reset)
│   └── README.md                  ← how to add a template
└── voices/                        ← Suno voice configurations per mode
```

**Template format (per file):**

Each template is a markdown file with:
- Metadata (length, target emotion, source attribution, tone notes)
- Structural beats (opening, body, transition, closing)
- Pacing markers (approximate seconds per beat)
- Breath cue placement
- Example phrases (not to copy, but to show register)

**Sourcing process:**
1. Identify high-rated meditations (YouTube comments, Insight Timer ratings, Reddit r/Meditation recs).
2. Transcribe (Whisper or manual).
3. Strip into structural beats — do not paraphrase the narrator's specific phrasings (copyright). The skeleton is the asset, not the words.
4. Add metadata + tone notes.
5. Test by feeding the template + a user situation to the LLM and checking output quality.

**Why this works:** templates encode the craft of professional narrators (pacing, breath, structure) without copying their content. The LLM fills in personalized language. Suno generates the voice. The user gets something that *sounds* professionally produced because it's built on professional structure.

**Aim for 30–50 templates at MVP.** Cover the top emotional situations: anxiety, sleep, gratitude, self-compassion, anger, grief, focus, confidence, decision-making, transitions.

---

## 8. The kill features (why someone switches from Meditopia to Kokoro)

In priority order:

1. **Every meditation addresses you by your chosen pet name.** Liz hears *"Зай, выдохни"* instead of *"Take a deep breath."* The McKinsey friend hears *"Brother, one rep."* This alone changes the emotional register more than any feature competitors can ship in six months. It is the product, not a setting.
2. **Voice-first capture solves the moment competitors don't serve.** When you can't name what you feel, you don't browse — you just talk. Suno plus a language model generates the meditation in seconds.
3. **Editorial design language.** The category looks medical-soft. Kokoro looks like a luxury brand. This is a free moat — no competitor will redesign their app aggressively because they have audience inertia to protect.
4. **Continuity across sessions.** *"Yesterday you talked about your mom. Tonight let's process it."* Static libraries cannot do this.
5. **Two modes for two markets, three content types in each.** Soft for Liz, sharp for the McKinsey friend. Unwind to release, Attract to envision, Lock In to commit. Same engine, no brand split, no team split.

---

## 9. Go-to-market hooks (to test before full launch)

Run three landing pages or three TikTok/Reels concepts. The product is the same; the hook differs.

- **Hook A — Emotional:** *"For when you want to vent but don't want to bother your friends again."* Targets Persona A (Liz). Maps to Unwind content type, soft mode.
- **Hook B — Future Self:** *"An AI voice ritual that makes your dream life feel real every morning."* Targets Persona C and aspirational users in both modes. Maps to Attract content type.
- **Hook C — Performance:** *"Mental pre-workout for discipline, money, confidence."* Targets Persona B (McKinsey friend). Maps to Lock In content type, sharp mode.

Whichever hook produces the lowest CAC and highest D7 retention is the lead acquisition strategy. The other two stay live as secondary funnels.

---

## 10. Risks and open questions

### Top risks

1. **Voice quality.** Suno is strong, ElevenLabs is strong, but neither is yet at the level of a professional meditation narrator with years of vocal coaching. Liz abandoned other apps over voice. **Mitigation:** test three Suno voice configurations against 5–10 women like Liz before any feature work. If they say *"приятно"*, ship. If they say *"что-то не то"*, fix the voice problem before everything else.
2. **Generation latency.** If audio takes 20+ seconds to render, the magic dies. **Mitigation:** make the loading screen *be* the breathing warm-up — by the time the breath cycle is done, audio starts. Pre-generate the next likely meditation while the current one plays.
3. **Sharp mode flow may need different UX.** The McKinsey friend probably doesn't want to vent — he wants to commit to a state. **Mitigation:** test sharp mode with a chips-only flow (*Pitch / Workout / Cold call / Deep work*) and skip the speak step. May reveal that soft and sharp need slightly different default flows even though the engine is shared.
4. **Daily retention vs novelty retention.** The "vent → meditation" wedge gets the install. Daily ritual gets the subscription. Programs and continuity are what build the habit. **Mitigation:** ship programs early in V1, not late.
5. **Copy quality.** The current copy on the design (*"What is your kokoro holding?"* / *"You are not being dramatic. You are carrying anger, pressure…"*) is exceptional. If generated copy in production is 70% as good, retention drops. **Mitigation:** human-curate the prompt library aggressively. Treat prompts as product, not as code.
6. **Pet name register risk.** The wrong pet name kills the magic instantly. *"Brother"* delivered in a soft female voice feels off; *"котёнок"* delivered to a man in sharp mode feels off. **Mitigation:** pet-name choices are constrained per mode in onboarding (the user picks from a curated list per mode, plus a free-text option). Free-text needs guardrails — flag jokey or self-harming pet names.

### Open questions

- Does the multi-step capture flow (capture → mirror → transition → skin → composing → player) feel ritual-rich, or does it feel slow? Quick Reset bypasses it; that's probably enough. Validate with users.
- Apple Health integration (*"good girl, you hit 10k steps today"*) — fun, but does it dilute the meditation positioning? Defer to V2.
- Multi-language: launch English first, Russian within 30 days because the founder's network is heavily Russian-speaking and Liz is Russian-speaking. Other languages later.
- Should the Attract content type ever be triggered automatically (e.g. on a Sunday morning) or is it always user-initiated? Probably user-initiated at MVP.

---

## 11. Roadmap

### MVP (now → 8 weeks)
Voice-first capture. Unwind / Attract / Lock In available in soft and sharp mode. 30+ templates. Three voices per mode. Pet name woven through every meditation. Quick Reset and Sleep mode shortcuts. English and Russian.

### V1 (MVP + 8 weeks)
Generated programs (multi-day arcs). Continuity engine connecting sessions across days. Voice library expanded. Subtle streak system. First paid tier introduced based on retention data.

### V2 (V1 + 12 weeks)
Apple Health hooks. Wearable / Apple Watch shortcut. Family or friend mode (send a meditation to someone). Programs branching on emotional history. More languages.

### Long-term
Live group meditations (community). Therapist partnerships (referral-based meditations). Hardware (sleep sound device).

---

## 12. Naming and brand

- **Kokoro (心)** — Japanese for heart-mind, the invisible vessel where feelings are stored and where life-force resides. Used in poetry and literature for centuries. Captures the emotional and spiritual dimension that "mind" or "heart" alone don't.
- The brand promise: *Kokoro holds what you carry, and gives back what you need.*
- Visual: dark warm palette (deep black, rust orange, soft cream), editorial serif typography, kanji as atmosphere not navigation, breathing animations in micro-interactions.
- Tone of voice: warm, premium, never therapeutic-clinical, never wellness-cliché. Closer to Aesop or Sunday Riley than to Calm or Headspace.
- Content type names on brand surface: 心 Unwind, 未 Attract, 志 Lock In. The kanji are atmospheric; the English verbs are functional.

---

## 13. Founder honest notes

The single most important thing to validate before everything else: **does the AI-generated voice, addressing the user by their pet name, retain users like a professional narrator does?**

If yes, Kokoro has a real business. The unit economics are extraordinary — every meditation is unique, no studio costs, no narrator licensing, infinite catalog.

If no, Kokoro becomes a feature inside someone else's app, not a standalone product.

Test the voice. Test the pet name. Then everything else.
