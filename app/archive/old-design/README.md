# Old Design

This folder contains the older black/orange Kokoro UI. It is kept intentionally for reference because a lot of design work went into it, but it is no longer the active app.

Active production UI:

- `app/src/screens/Kokoro3.tsx`
- `app/src/styles/kokoro3.css`

Archived here:

- Old screen components from `app/src/screens/`
- Old shared UI components from `app/src/components/`
- Old mode-selection stylesheet from `app/src/styles/modes.css`

Do not wire these files back into the app unless you are intentionally restoring the Kokoro 2 interface. They are outside `app/src`, so Vite and TypeScript ignore them during normal builds.
