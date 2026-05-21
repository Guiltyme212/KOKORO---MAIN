import { tgUser } from './telegram';
import type { LibraryItem, LibraryListOutput } from './types-meditation';
import { API_BASE } from './config';
import { answersApi } from '../state/answers';
import { generatedMeditationApi } from '../state/generatedMeditation';

class LibraryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const LOCAL_KEY = 'kokoro_local_library';

const readLocalLibrary = (): LibraryItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is LibraryItem => (
        item &&
        typeof item === 'object' &&
        typeof item.meditationId === 'string' &&
        typeof item.audioUrl === 'string' &&
        typeof item.vibe === 'string'
      ))
      .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  } catch {
    return [];
  }
};

const writeLocalLibrary = (items: LibraryItem[]): void => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    throw new LibraryError('LOCAL_STORAGE_UNAVAILABLE', 'Could not save on this device.');
  }
};

const buildLocalLibraryItem = (meditationId: string): LibraryItem => {
  const current = generatedMeditationApi.getSnapshot();
  const generated = current?.meditationId === meditationId
    ? current
    : Object.values(generatedMeditationApi.getByVibeSnapshot())
      .find((item) => item?.meditationId === meditationId);

  if (!generated) {
    throw new LibraryError('NO_LOCAL_MEDITATION', 'Open the meditation before saving it.');
  }

  const audioUrl = generated.audioUrl || generated.streamAudioUrl || '';
  if (!audioUrl) {
    throw new LibraryError('AUDIO_NOT_READY', 'Final audio is still preparing.');
  }

  const answers = answersApi.getSnapshot();
  const preview = answers.carry.trim() || [answers.feeling, answers.source].filter(Boolean).join(' - ');
  const now = new Date().toISOString();

  return {
    meditationId,
    audioUrl,
    durationSec: generated.durationSec,
    callMe: answers.callMe || answers.realName || 'friend',
    realName: answers.realName,
    vibe: generated.vibe,
    capturePreview: preview || undefined,
    savedAt: now,
    generatedAt: generated.generatedAt || now,
  };
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
  const user = tgUser();
  if (!user) {
    const item = buildLocalLibraryItem(meditationId);
    const next = [item, ...readLocalLibrary().filter((existing) => existing.meditationId !== meditationId)];
    writeLocalLibrary(next);
    return next;
  }

  const tgUserId = user.id;
  const res = await fetch(`${API_BASE}/library/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ meditationId, tgUserId }),
  });
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export async function listLibrary(): Promise<LibraryItem[]> {
  const user = tgUser();
  if (!user) return readLocalLibrary();

  const tgUserId = user.id;
  const url = new URL(`${API_BASE}/library`);
  url.searchParams.set('tgUserId', String(tgUserId));
  const res = await fetch(url.toString());
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export async function removeFromLibrary(meditationId: string): Promise<LibraryItem[]> {
  const user = tgUser();
  if (!user) {
    const next = readLocalLibrary().filter((item) => item.meditationId !== meditationId);
    writeLocalLibrary(next);
    return next;
  }

  const tgUserId = user.id;
  const res = await fetch(`${API_BASE}/library/items/${encodeURIComponent(meditationId)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tgUserId }),
  });
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export const isLibraryAvailable = (): boolean => true;
