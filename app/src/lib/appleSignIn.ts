import { Capacitor } from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';

const IOS_BUNDLE_ID = 'com.kokoromind.app';
const DEFAULT_SCOPES = 'email name';

export type AppleAccount = {
  provider: 'apple';
  userId: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  fullName?: string;
  signedInAt: string;
};

export type AppleSignInResult = {
  account: AppleAccount;
  identityToken: string;
  authorizationCode: string;
};

function env(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  return value?.trim() ?? '';
}

function getClientId(): string {
  if (Capacitor.getPlatform() === 'ios') {
    return env('VITE_APPLE_SIGN_IN_CLIENT_ID') || IOS_BUNDLE_ID;
  }
  return env('VITE_APPLE_SIGN_IN_CLIENT_ID');
}

function getRedirectURI(): string {
  return env('VITE_APPLE_SIGN_IN_REDIRECT_URI') || window.location.origin;
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function randomToken(bytes = 24): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

function readJwtSubject(token: string): string | undefined {
  try {
    const [, payload] = token.split('.');
    if (!payload) return undefined;
    const parsed = JSON.parse(decodeBase64Url(payload)) as { sub?: unknown };
    return typeof parsed.sub === 'string' ? parsed.sub : undefined;
  } catch {
    return undefined;
  }
}

export function isAppleSignInAvailable(): boolean {
  if (Capacitor.getPlatform() === 'ios') return true;
  return Boolean(env('VITE_APPLE_SIGN_IN_CLIENT_ID') && env('VITE_APPLE_SIGN_IN_REDIRECT_URI'));
}

export function isAppleSignInCanceled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /cancel|canceled|cancelled/i.test(message);
}

export function friendlyAppleSignInError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/No options were provided/i.test(message)) {
    return 'Apple Sign In is not configured yet.';
  }
  if (/Unable to load Sign in with Apple JS/i.test(message)) {
    return 'Apple Sign In could not load. Check the connection and try again.';
  }
  return message || 'Apple Sign In did not finish. Try again in a moment.';
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  if (!isAppleSignInAvailable()) {
    throw new Error('Apple Sign In needs a client ID and redirect URL for this platform.');
  }

  const result = await SignInWithApple.authorize({
    clientId: getClientId(),
    redirectURI: getRedirectURI(),
    scopes: DEFAULT_SCOPES,
    state: randomToken(),
    nonce: randomToken(),
  });

  const response = result.response;
  const identityToken = clean(response.identityToken);
  const authorizationCode = clean(response.authorizationCode);
  const userId = clean(response.user) || (identityToken ? readJwtSubject(identityToken) : undefined);

  if (!userId || !identityToken || !authorizationCode) {
    throw new Error('Apple did not return the credentials Kokoro needs.');
  }

  const givenName = clean(response.givenName);
  const familyName = clean(response.familyName);
  const fullName = clean([givenName, familyName].filter(Boolean).join(' '));

  return {
    account: {
      provider: 'apple',
      userId,
      email: clean(response.email),
      givenName,
      familyName,
      fullName,
      signedInAt: new Date().toISOString(),
    },
    identityToken,
    authorizationCode,
  };
}
