import { useSyncExternalStore } from 'react';
import { PERSONA_DEFAULT, type Persona } from '../types';

const KEY = 'kokoro_persona';
const THEMES_CAP = 20;
const MEDITATIONS_CAP = 3;

let state: Persona = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...PERSONA_DEFAULT, ...JSON.parse(raw) } : PERSONA_DEFAULT;
  } catch {
    return PERSONA_DEFAULT;
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

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  subs.forEach((fn) => fn());
}

function set(partial: Partial<Persona>) {
  state = { ...state, ...partial };
  persist();
}

function addTheme(rawLabel: string) {
  const label = rawLabel.trim();
  if (!label) return;
  const existing = state.themes
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const lowered = label.toLowerCase();
  const deduped = existing.filter((t) => t.toLowerCase() !== lowered);
  const next = [label, ...deduped].slice(0, THEMES_CAP);
  state = { ...state, themes: next.join(', ') };
  persist();
}

function recordMeditation({ vibe, feeling }: { vibe: string; feeling?: string }) {
  const entry = feeling ? `${vibe} (${feeling})` : vibe;
  const existing = state.meditations
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const next = [entry, ...existing].slice(0, MEDITATIONS_CAP);
  state = { ...state, meditations: next.join('; ') };
  persist();
}

function reset() {
  state = PERSONA_DEFAULT;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  subs.forEach((fn) => fn());
}

export function usePersona() {
  const persona = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { persona };
}

export const personaApi = { set, addTheme, recordMeditation, reset, getSnapshot };
