import { useCallback, useSyncExternalStore } from 'react';
import type { GenerateMeditationOutput } from '../lib/types-meditation';

const KEY = 'kokoro_generated_meditation';

let state: GenerateMeditationOutput | null = (() => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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

function set(value: GenerateMeditationOutput | null) {
  state = value;
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* session storage unavailable */
  }
  subs.forEach((fn) => fn());
}

function update(partial: Partial<GenerateMeditationOutput>) {
  if (!state) return;
  set({ ...state, ...partial });
}

export function useGeneratedMeditation() {
  const generated = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setGenerated = useCallback((value: GenerateMeditationOutput | null) => set(value), []);
  return { generated, setGenerated };
}

export const generatedMeditationApi = { set, update, getSnapshot };
