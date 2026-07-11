import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { isProtectedWebClient, isStandaloneDisplay } from '../lib/platform';

/* One-shot install offer: set on a fresh code-verified login, cleared once the
   user answers the install screen. sessionStorage so it never outlives the tab. */
const FRESH_LOGIN_KEY = 'kokoro_fresh_login';

export function markFreshLogin(): void {
  try { sessionStorage.setItem(FRESH_LOGIN_KEY, '1'); } catch { /* private mode */ }
}

export function clearInstallOffer(): void {
  try { sessionStorage.removeItem(FRESH_LOGIN_KEY); } catch { /* private mode */ }
}

export function shouldOfferInstall(): boolean {
  if (!isProtectedWebClient() || isStandaloneDisplay()) return false;
  try { return sessionStorage.getItem(FRESH_LOGIN_KEY) === '1'; } catch { return false; }
}

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type PwaSnapshot = {
  canInstall: boolean;
  updateReady: boolean;
};

let snapshot: PwaSnapshot = { canInstall: false, updateReady: false };
let installPrompt: InstallPrompt | null = null;
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
let initialized = false;
const listeners = new Set<() => void>();

const emit = (patch: Partial<PwaSnapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};

function initialize(): void {
  if (initialized || !isProtectedWebClient()) return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    emit({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    emit({ canInstall: false });
  });
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: () => emit({ updateReady: true }),
  });
}

async function install(): Promise<void> {
  if (!installPrompt) return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  emit({ canInstall: false });
}

async function update(): Promise<void> {
  if (!applyUpdate) return;
  await applyUpdate(true);
}

export const pwaApi = {
  initialize,
  install,
  update,
  dismissUpdate: () => emit({ updateReady: false }),
  getSnapshot: (): PwaSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const usePwa = (): PwaSnapshot =>
  useSyncExternalStore(pwaApi.subscribe, pwaApi.getSnapshot, pwaApi.getSnapshot);
