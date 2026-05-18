# Handoff - Kokoro 3.0 Integration

Date: 2026-05-16

## Summary

Kokoro is mid-migration from the old dark/orange frontend to the new Kokoro 3.0 cream/moss/mustard design. The backend meditation generation path still works and should be preserved. The new direction is a real Kokoro companion chat powered by an ElevenLabs agent, with meditation generation triggered from inside the conversation.

The active design source is:

- `Kokoro Design System (2)/kokoro-3-0/project/Kokoro Welcome Screen.html`
- `Kokoro Design System (2)/kokoro-3-0/project/tokens.css`
- `Kokoro Design System (2)/kokoro-3-0/project/assets/`

Use the prototype CSS directly when correcting layout. Do not approximate from screenshots unless a screen is absent from the HTML.

## Implemented

- New frontend surfaces live in `app/src/screens/Kokoro3.tsx` and `app/src/styles/kokoro3.css`.
- Kokoro 3.0 assets are copied into `app/public/kokoro3/`.
- `App.tsx` maps normal routes to 3.0 screens.
- Router includes new routes: `feeling`, `source`, `promise`, `chat`.
- Legacy routes remain as compatibility aliases.
- ElevenLabs React SDK is installed.
- Backend route `GET /elevenlabs/conversation-token` returns a private WebRTC conversation token.
- Local env has agent config; never commit the API key.
- Meditation generation should start one selected vibe, not all five.
- Style cards remain in chat: raw, cosmic, iron, sleep, zen.

## ElevenLabs Config

Environment variables:

```env
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=agent_3101krqbh19mezt9t835q2f7s5ds
ELEVENLABS_BRANCH_ID=agtbrch_8101krqbh39jefytppvjqqth40c5
ELEVENLABS_ENVIRONMENT=production
```

The frontend must never receive the API key. It only asks the backend token route for a conversation token.

## Visual Gotchas

The Kokoro videos are not alpha-transparent. They are normal MP4s with cream backgrounds. The cutout effect depends on:

- Opaque cream screen background.
- `mix-blend-mode: multiply` on the child video.
- `mask-image` and `-webkit-mask-image` on the wrapper.
- `autoplay loop muted playsinline` on the video.

For peeking Kokoro, the wrapper/video structure matters:

```tsx
<div className="k3-peek-wrap k3-peek-wrap--right">
  <video autoPlay loop muted playsInline>
    <source src="/kokoro3/kokoro-peak.mp4" type="video/mp4" />
  </video>
</div>
```

If a visible rectangle appears, compare against the original `.peek-wrap`, `.peek-wrap--right`, `.kokoro-stage`, and `kokoro-slot` CSS in `Kokoro Welcome Screen.html`.

The prototype stack for welcome is important:

- peeking video: z-index 3
- sun: z-index 6
- bubble: z-index 7 or above

Putting the video above the sun can make the video's baked cream background visibly fog the orange sun.

## Testing State

Passing:

- `cd app && pnpm build`
- `cd app && pnpm lint`
- `cd api && uv run pytest tests/routes/test_elevenlabs.py`
- changed backend route/config ruff + mypy checks

Known issue:

- Full `cd api && uv run pytest` currently fails during collection because `api/tests/pipeline/test_validate_lyrics.py` imports removed symbol `validate_meditation_output`.

## Do Not Do

- Do not reintroduce `kickoffAllMeditations()` into the 3.0 chat flow.
- Do not use `kokoro-board.png` as an in-app thumbnail; it is a design board screenshot.
- Do not commit `api/.env` or any API key.
- Do not replace the video masking/blending with a guessed CSS version; copy from the handoff HTML first.
