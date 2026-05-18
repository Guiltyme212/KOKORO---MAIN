# Kokoro Frontend

Vite + React + TypeScript frontend for Kokoro. The active UI is the Kokoro 3.0 cream/moss/mustard flow in `src/screens/Kokoro3.tsx` and `src/styles/kokoro3.css`.

## Current Flow

`welcome -> name -> feeling -> source -> promise -> chat -> player/home/library`

Design reference:

- `../Kokoro Design System (2)/kokoro-3-0/project/Kokoro Welcome Screen.html`
- `../Kokoro Design System (2)/kokoro-3-0/project/tokens.css`
- `../Kokoro Design System (2)/kokoro-3-0/project/assets/`

Assets used by the app are copied to `public/kokoro3/`.

## Commands

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
```

## Important Visual Note

The Kokoro MP4s are regular videos with cream backgrounds, not true alpha video. The cutout illusion needs:

- an opaque cream parent background
- `mix-blend-mode: multiply` on the child video
- wrapper `mask-image` plus `-webkit-mask-image`
- `autoplay loop muted playsinline`

Copy the wrapper/video structure from the original handoff HTML when fixing mascot placement. Do not approximate this effect from screenshots.

## Chat + Generation

Chat uses `@elevenlabs/react`. The frontend fetches a private conversation token from the API via `src/lib/elevenlabs.ts`.

Meditation generation still calls `/meditations/stream`, but the 3.0 flow should generate one selected vibe from inside chat, not all five at once.
