import { useCallback, useSyncExternalStore } from 'react';
import type { GenerateMeditationOutput } from '../lib/types-meditation';
import type { Vibe } from '../types';

// Two stores in one module:
//
// 1. `state` — the single "currently playing" record Player.tsx reads. Same
//    shape and behavior as before; SaveButton, audio src freezing, and all
//    Player code stays untouched.
//
// 2. `byVibe` — the new per-vibe map populated by the multi-vibe pipeline
//    (one slot per vibe as each `streaming` / `ready` event lands). When the
//    user taps a card on PickWhatLands, that vibe's record is promoted into
//    `state` via `selectVibeAsCurrent`, then Player navigates and reads it.

const KEY = 'kokoro_generated_meditation';
const KEY_BY_VIBE = 'kokoro_generated_meditations_by_vibe';

let state: GenerateMeditationOutput | null = (() => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

let byVibe: Partial<Record<Vibe, GenerateMeditationOutput>> = (() => {
  try {
    const raw = sessionStorage.getItem(KEY_BY_VIBE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

const subs = new Set<() => void>();

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};

const getSnapshot = () => state;
const getByVibeSnapshot = () => byVibe;

const persistState = () => {
  try {
    if (state) sessionStorage.setItem(KEY, JSON.stringify(state));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* session storage unavailable */
  }
};

const persistByVibe = () => {
  try {
    sessionStorage.setItem(KEY_BY_VIBE, JSON.stringify(byVibe));
  } catch {
    /* session storage unavailable */
  }
};

function set(value: GenerateMeditationOutput | null) {
  state = value;
  persistState();
  subs.forEach((fn) => fn());
}

function update(partial: Partial<GenerateMeditationOutput>) {
  if (!state) return;
  set({ ...state, ...partial });
}

function setForVibe(vibe: Vibe, value: GenerateMeditationOutput) {
  byVibe = { ...byVibe, [vibe]: value };
  persistByVibe();
  subs.forEach((fn) => fn());
}

function updateForVibe(vibe: Vibe, partial: Partial<GenerateMeditationOutput>) {
  const existing = byVibe[vibe];
  if (!existing) return;
  byVibe = { ...byVibe, [vibe]: { ...existing, ...partial } };
  persistByVibe();
  subs.forEach((fn) => fn());
}

function selectVibeAsCurrent(vibe: Vibe) {
  const record = byVibe[vibe];
  if (!record) return;
  set(record);
}

function resetAll() {
  state = null;
  byVibe = {};
  persistState();
  persistByVibe();
  subs.forEach((fn) => fn());
}

export function useGeneratedMeditation() {
  const generated = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setGenerated = useCallback((value: GenerateMeditationOutput | null) => set(value), []);
  return { generated, setGenerated };
}

export function useGeneratedMeditationsByVibe() {
  return useSyncExternalStore(subscribe, getByVibeSnapshot, getByVibeSnapshot);
}

export const generatedMeditationApi = {
  set,
  update,
  setForVibe,
  updateForVibe,
  selectVibeAsCurrent,
  resetAll,
  getSnapshot,
  getByVibeSnapshot,
};
