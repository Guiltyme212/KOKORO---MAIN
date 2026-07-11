import { useSyncExternalStore } from 'react';
import { API_BASE } from '../lib/config';
import { webAuthProvider, type AuthSession } from '../lib/authProvider';
import { isProtectedWebClient } from '../lib/platform';
import { markFreshLogin } from './pwa';

export type AccessResult = {
  access: boolean;
  status: string;
  accessUntil: string | null;
  cancelAtPeriodEnd: boolean;
  graceUntil: string | null;
  purchaseUrl?: string;
  manageUrl: string;
};

type WebAuthStatus =
  | 'disabled'
  | 'initializing'
  | 'signedOut'
  | 'verifying'
  | 'checkingAccess'
  | 'allowed'
  | 'denied'
  | 'accessError';

type WebAuthSnapshot = {
  status: WebAuthStatus;
  session: AuthSession | null;
  pendingEmail: string;
  handoffToken: string;
  maskedEmail: string;
  access: AccessResult | null;
  error: string;
};

const initial: WebAuthSnapshot = {
  status: isProtectedWebClient() ? 'initializing' : 'disabled',
  session: null,
  pendingEmail: '',
  handoffToken: '',
  maskedEmail: '',
  access: null,
  error: '',
};

let snapshot = initial;
let initializePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = (patch: Partial<WebAuthSnapshot>): void => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};

const apiError = async (response: Response): Promise<string> => {
  const body = await response.json().catch(() => ({})) as {
    error?: string;
    detail?: { error?: string };
  };
  return body.error ?? body.detail?.error ?? `HTTP_${response.status}`;
};

const handoffFromHash = (): string => {
  const query = window.location.hash.split('?', 2)[1] ?? '';
  return new URLSearchParams(query).get('handoff')?.trim() ?? '';
};

async function loadHandoff(handoffToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/auth/handoffs/info`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handoffToken }),
  });
  if (!response.ok) throw new Error(await apiError(response));
  const body = await response.json() as { maskedEmail: string };
  emit({
    status: 'verifying',
    handoffToken,
    maskedEmail: body.maskedEmail,
    error: '',
  });
}

async function checkAccess(forceRefresh = false): Promise<void> {
  const session = await webAuthProvider.restoreSession();
  if (!session) {
    emit({ status: 'signedOut', session: null, access: null });
    return;
  }
  emit({ status: 'checkingAccess', session, error: '' });
  const url = new URL(`${API_BASE}/v1/access`);
  if (forceRefresh) url.searchParams.set('refresh', 'true');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
  } catch {
    emit({ status: 'accessError', error: 'ACCESS_CHECK_UNAVAILABLE' });
    return;
  }
  if (response.status === 401) {
    await webAuthProvider.signOut().catch(() => undefined);
    emit({ status: 'signedOut', session: null, access: null, error: 'SESSION_EXPIRED' });
    return;
  }
  if (!response.ok) {
    emit({ status: 'accessError', error: await apiError(response) });
    return;
  }
  const access = await response.json() as AccessResult;
  emit({
    status: access.access ? 'allowed' : 'denied',
    access,
    error: '',
  });
}

async function initialize(): Promise<void> {
  if (!isProtectedWebClient()) {
    emit({ status: 'disabled' });
    return;
  }
  if (initializePromise) return initializePromise;
  initializePromise = (async () => {
    try {
      const session = await webAuthProvider.restoreSession();
      if (session) {
        await checkAccess();
        return;
      }
      const handoffToken = handoffFromHash();
      if (handoffToken) {
        try {
          await loadHandoff(handoffToken);
          return;
        } catch {
          window.history.replaceState(null, '', '#login');
        }
      }
      emit({ status: 'signedOut', session: null, error: '' });
    } catch (error) {
      emit({
        status: 'signedOut',
        error: error instanceof Error ? error.message : 'AUTH_UNAVAILABLE',
      });
    }
  })();
  return initializePromise;
}

async function requestCode(email: string, captchaToken?: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await webAuthProvider.supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      ...(captchaToken ? { captchaToken } : {}),
    },
  });
  if (error) throw new Error('The code could not be sent. Please wait and try again.');
  emit({
    status: 'verifying',
    pendingEmail: normalizedEmail,
    handoffToken: '',
    maskedEmail: '',
    error: '',
  });
}

async function verifyCode(otp: string): Promise<void> {
  if (snapshot.handoffToken) {
    const response = await fetch(`${API_BASE}/v1/auth/handoffs/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handoffToken: snapshot.handoffToken, otp }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    const body = await response.json() as {
      accessToken: string;
      refreshToken: string;
    };
    const { error } = await webAuthProvider.supabase.auth.setSession({
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
    });
    if (error) throw error;
  } else {
    if (!snapshot.pendingEmail) throw new Error('Enter your email again.');
    const { error } = await webAuthProvider.supabase.auth.verifyOtp({
      email: snapshot.pendingEmail,
      token: otp,
      type: 'email',
    });
    if (error) throw new Error('That code is invalid or expired.');
  }
  markFreshLogin();
  window.history.replaceState(null, '', '#checkingAccess');
  await checkAccess(true);
}

async function resendCode(captchaToken?: string): Promise<void> {
  if (snapshot.handoffToken) {
    const response = await fetch(`${API_BASE}/v1/auth/handoffs/resend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handoffToken: snapshot.handoffToken }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    return;
  }
  if (!snapshot.pendingEmail) throw new Error('Enter your email again.');
  await requestCode(snapshot.pendingEmail, captchaToken);
}

async function signOut(): Promise<void> {
  await webAuthProvider.signOut();
  window.history.replaceState(null, '', '#login');
  emit({
    status: 'signedOut',
    session: null,
    pendingEmail: '',
    handoffToken: '',
    maskedEmail: '',
    access: null,
    error: '',
  });
}

function beginEmailLogin(): void {
  window.history.replaceState(null, '', '#login');
  emit({
    status: 'signedOut',
    pendingEmail: '',
    handoffToken: '',
    maskedEmail: '',
    error: '',
  });
}

async function deleteAccount(): Promise<void> {
  const token = await webAuthProvider.getAccessToken();
  if (!token) throw new Error('SESSION_EXPIRED');
  const response = await fetch(`${API_BASE}/v1/account`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await apiError(response));
  await webAuthProvider.signOut().catch(() => undefined);
  emit({ ...initial, status: 'signedOut' });
}

export const webAuthApi = {
  initialize,
  requestCode,
  verifyCode,
  resendCode,
  checkAccess,
  beginEmailLogin,
  signOut,
  deleteAccount,
  getSnapshot: (): WebAuthSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useWebAuth = (): WebAuthSnapshot =>
  useSyncExternalStore(webAuthApi.subscribe, webAuthApi.getSnapshot, webAuthApi.getSnapshot);
