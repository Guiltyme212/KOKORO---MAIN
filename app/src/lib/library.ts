import { tgUser } from './telegram';
import type { LibraryItem, LibraryListOutput } from './types-meditation';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787';

class LibraryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const requireTgUserId = (): number => {
  const user = tgUser();
  if (!user) {
    throw new LibraryError(
      'NO_TG_USER',
      'Library requires Telegram identity. Open this app inside Telegram to save meditations.',
    );
  }
  return user.id;
};

async function expectOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new LibraryError(
      body.error ?? `HTTP_${res.status}`,
      body.details?.message ?? `library api ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function saveToLibrary(meditationId: string): Promise<LibraryItem[]> {
  const tgUserId = requireTgUserId();
  const res = await fetch(`${API_BASE}/library/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ meditationId, tgUserId }),
  });
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export async function listLibrary(): Promise<LibraryItem[]> {
  const tgUserId = requireTgUserId();
  const url = new URL(`${API_BASE}/library`);
  url.searchParams.set('tgUserId', String(tgUserId));
  const res = await fetch(url.toString());
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export async function removeFromLibrary(meditationId: string): Promise<LibraryItem[]> {
  const tgUserId = requireTgUserId();
  const res = await fetch(`${API_BASE}/library/items/${encodeURIComponent(meditationId)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tgUserId }),
  });
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export const isLibraryAvailable = (): boolean => tgUser() !== null;
