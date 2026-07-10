import { webAuthProvider } from './authProvider';
import { API_BASE } from './config';
import { isProtectedWebClient } from './platform';

export const apiPath = (legacyPath: string): string =>
  isProtectedWebClient() ? `/v1${legacyPath}` : legacyPath;

export async function apiFetch(
  legacyPath: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (isProtectedWebClient()) {
    const token = await webAuthProvider.getAccessToken();
    if (!token) throw new Error('AUTH_REQUIRED');
    headers.set('authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${apiPath(legacyPath)}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}
