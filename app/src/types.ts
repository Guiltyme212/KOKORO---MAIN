/**
 * Five tonal vibes the user picks. Each maps 1:1 to a backend Template
 * (api/templates/vibe_*_01.json) which carries the reference transcript +
 * audio used to steer the generated meditation.
 */
export type Vibe = 'raw' | 'cosmic' | 'iron' | 'zen' | 'sleep';

export type Answers = {
  callMe: string;
  realName?: string;
  carry: string;
  chips: string[];
  vibe: Vibe | '';
  feeling?: string;
  source?: string;
};

export const ANSWERS_DEFAULT: Answers = {
  callMe: '',
  carry: '',
  chips: [],
  vibe: '',
};

/**
 * Cross-session memory. Persisted under `kokoro_persona` in localStorage.
 * Survives the welcome-screen reset that clears `answers`, so the ElevenLabs
 * agent can address a returning user without restarting from scratch.
 */
export type Persona = {
  callMe: string;
  realName?: string;
  themes: string;
  meditations: string;
};

export const PERSONA_DEFAULT: Persona = {
  callMe: '',
  themes: '',
  meditations: '',
};
