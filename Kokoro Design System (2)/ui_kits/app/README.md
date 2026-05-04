# Kokoro · App UI kit

Interactive recreation of the 8-step Kokoro Telegram WebApp flow, in a 440 × 900 phone frame.

## Components

- `Components.jsx` — atoms: `Stepper`, `TopRow`, `Eyebrow`, `KanjiBg`, `Cta`, `Chip`, `ShapeCard`, `VoiceTile`, `Tabs`, `MicVisualiser`
- `Screens.jsx` — one per step: `ScreenWelcome`, `ScreenName`, `ScreenCapture`, `ScreenMirror`, `ScreenShape`, `ScreenComposing`, `ScreenPlayer`, `ScreenReflect`, `ScreenLibrary`
- `kit.css` — bundled tokens (mirror of root `colors_and_type.css`) + component styles

## Disclaimers

- Built from screenshots only — see root `README.md` for what's inferred vs sampled.
- No real audio, no real Telegram bridge, no real LLM composition. Recording timer ticks while you tap the mic; Composing auto-advances to Player after 2.2s.
- Interactions implemented: full screen-to-screen navigation, mic on/off, tab toggle (Speak/Type/Tap), pet-name selection, shape + voice selection, reflect word picking. Things that aren't real: actual capture, the LLM call, save-to-library.
