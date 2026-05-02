import { useCallback, useSyncExternalStore } from 'react';
import { ANSWERS_DEFAULT, type Answers } from '../types';

const KEY = 'kokoro_answers';

let state: Answers = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...ANSWERS_DEFAULT, ...JSON.parse(raw) } : ANSWERS_DEFAULT;
  } catch {
    return ANSWERS_DEFAULT;
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

function set<K extends keyof Answers>(key: K, value: Answers[K]) {
  state = { ...state, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  subs.forEach((fn) => fn());
}

function reset() {
  state = ANSWERS_DEFAULT;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  subs.forEach((fn) => fn());
}

export function useAnswers() {
  const answers = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setAnswer = useCallback(
    <K extends keyof Answers>(key: K, value: Answers[K]) => set(key, value),
    [],
  );
  return { answers, setAnswer, reset };
}

export const answersApi = { set, reset, getSnapshot };
