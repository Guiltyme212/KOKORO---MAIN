import { tgUser } from './telegram';
import type { LibraryItem, LibraryListOutput } from './types-meditation';
import { apiFetch } from './apiTransport';
import { isProtectedWebClient } from './platform';
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

const CAPTURE_FIELD_LABELS = [
  'User name',
  'Call them',
  'How they are carrying today',
  'Where it seems to be coming from',
  'What they told Kokoro',
];

function extractCaptureField(capture: string, label: string): string {
  const labels = CAPTURE_FIELD_LABELS
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${escaped}:\\s*([\\s\\S]*?)(?=\\n(?:${labels}):|$)`);
  return capture.match(re)?.[1]?.trim() ?? '';
}

function shortenPreview(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= 90) return clean;
  const clipped = clean.slice(0, 89).trimEnd();
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 44 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}...`;
}

function buildCapturePreview(): string | undefined {
  const answers = answersApi.getSnapshot();
  const raw = answers.carry.trim();
  let preview = raw;

  if (raw && CAPTURE_FIELD_LABELS.some((label) => raw.includes(`${label}:`))) {
    preview = extractCaptureField(raw, 'What they told Kokoro');
  }

  preview = preview
    .replace(/^\s*(?:\.\.\.|[.?!,-])+\s*/, '')
    .replace(/\bjust make it\b\.?/gi, '')
    .replace(/\bright now\b\.?/gi, '')
    .replace(/\bnow\b\.?/gi, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  preview = preview
    .replace(/^please\s+/i, '')
    .replace(/^make\s+(?:me\s+)?(?:a\s+)?(?:meditation|ritual|song)\s+(?:about|for)\s+/i, 'About ')
    .replace(/^i\s+(?:want|need)\s+(?:a\s+)?(?:meditation|ritual|song)\s+(?:about|for)\s+/i, 'About ')
    .trim();

  if (!preview) {
    preview = [answers.feeling, answers.source].filter(Boolean).join(' - ');
  }

  return preview ? shortenPreview(preview) : undefined;
}

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
  const now = new Date().toISOString();

  return {
    meditationId,
    audioUrl,
    durationSec: generated.durationSec,
    callMe: answers.callMe || answers.realName || 'friend',
    realName: answers.realName,
    vibe: generated.vibe,
    capturePreview: buildCapturePreview(),
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
  if (isProtectedWebClient()) {
    const res = await apiFetch('/library/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meditationId }),
    });
    const out = await expectOk<LibraryListOutput>(res);
    return out.items;
  }

  const user = tgUser();
  if (!user) {
    const item = buildLocalLibraryItem(meditationId);
    const next = [item, ...readLocalLibrary().filter((existing) => existing.meditationId !== meditationId)];
    writeLocalLibrary(next);
    return next;
  }

  const tgUserId = user.id;
  const res = await apiFetch('/library/items', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ meditationId, tgUserId }),
  });
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export async function listLibrary(): Promise<LibraryItem[]> {
  if (isProtectedWebClient()) {
    const res = await apiFetch('/library');
    const out = await expectOk<LibraryListOutput>(res);
    return out.items;
  }

  const user = tgUser();
  if (!user) return readLocalLibrary();

  const tgUserId = user.id;
  const res = await apiFetch(`/library?tgUserId=${encodeURIComponent(String(tgUserId))}`);
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export async function removeFromLibrary(meditationId: string): Promise<LibraryItem[]> {
  if (isProtectedWebClient()) {
    const res = await apiFetch(`/library/items/${encodeURIComponent(meditationId)}`, {
      method: 'DELETE',
    });
    const out = await expectOk<LibraryListOutput>(res);
    return out.items;
  }

  const user = tgUser();
  if (!user) {
    const next = readLocalLibrary().filter((item) => item.meditationId !== meditationId);
    writeLocalLibrary(next);
    return next;
  }

  const tgUserId = user.id;
  const res = await apiFetch(`/library/items/${encodeURIComponent(meditationId)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tgUserId }),
  });
  const out = await expectOk<LibraryListOutput>(res);
  return out.items;
}

export const isLibraryAvailable = (): boolean => true;
