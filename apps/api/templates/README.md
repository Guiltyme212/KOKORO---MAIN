# Meditation Templates

Each meditation generation seeds the LLM with a structural template so the output has professional pacing, breath cues, and beat structure. See `BUSINESS.md` §7 for the strategy.

## Format

Templates are JSON files organized by content type:

- `templates/unwind/` — process what happened (evening-coded)
- `templates/attract/` — cinematic visualization of who you're becoming (morning-coded)
- `templates/lockin/` — commit to a state in the next hour (situational)

Each file is validated by the loader (`api/src/templates/loader.ts`). Schema:

| Field | Type | Notes |
|---|---|---|
| `id` | string | snake_case, unique across all templates |
| `contentType` | `unwind` \| `attract` \| `lockin` | folder must match |
| `modes` | array of `soft` \| `sharp` | which tonal registers this template supports |
| `becomingMatch` | string[] | `becoming` keys this template is suitable for |
| `themeKeywords` | string[] | words from user input that bias the selector toward this template |
| `targetDurationSec` | number | total meditation length |
| `musicStylePrompt` | string | passed to Suno as style hint |
| `referenceTrackUrls` | string[] | 1–2 public URLs or filenames under `api/refs/`; backend resolves filenames with `REFERENCE_PUBLIC_BASE_URL` |
| `structure` | array of `{id, sec, intent}` | beat structure; sum of `sec` should approximate `targetDurationSec` |
| `registerNotes` | `{soft, sharp}` | tone notes per mode, injected into LLM prompt |

## Sourcing

Per `BUSINESS.md` §7: structural skeletons only — never paraphrase the source narrator's specific phrasings (copyright). The skeleton is the asset, not the words.

Aim for 30–50 templates at MVP. Cover anxiety, sleep, gratitude, self-compassion, anger, grief, focus, confidence, decision-making, transitions.
