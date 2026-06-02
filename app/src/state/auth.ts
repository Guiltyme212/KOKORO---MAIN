import { useCallback, useSyncExternalStore } from 'react';
import type { AppleAccount } from '../lib/appleSignIn';

type AuthState = {
  apple?: AppleAccount;
  lastProvider?: AppleAccount['provider'];
};

const KEY = 'kokoro_auth';

let state: AuthState = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as AuthState : {};
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

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  subs.forEach((fn) => fn());
}

function preferFresh(next: AppleAccount, current?: AppleAccount): AppleAccount {
  if (!current || current.userId !== next.userId) return next;
  return {
    ...current,
    ...next,
    email: next.email || current.email,
    givenName: next.givenName || current.givenName,
    familyName: next.familyName || current.familyName,
    fullName: next.fullName || current.fullName,
  };
}

function setAppleAccount(account: AppleAccount) {
  state = {
    ...state,
    apple: preferFresh(account, state.apple),
    lastProvider: 'apple',
  };
  persist();
}

function signOut() {
  state = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  subs.forEach((fn) => fn());
}

export function useAuth() {
  const auth = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setApple = useCallback((account: AppleAccount) => setAppleAccount(account), []);
  return { auth, setApple, signOut };
}

export const authApi = { setAppleAccount, signOut, getSnapshot };
