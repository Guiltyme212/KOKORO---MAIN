import { useSyncExternalStore } from 'react';
import { generatedMeditationApi } from './generatedMeditation';
import { libraryApi } from './library';
import { generateMeditationStreaming } from '../lib/api';
import { friendlyApiError } from '../lib/config';
import { uploadCapture } from '../lib/uploads';
import { captureAudioApi } from './captureAudio';
import { isInTelegram, tgUser, tgInitData } from '../lib/telegram';
import { makeRequestId } from '../lib/requestId';
import type { Answers, Vibe } from '../types';
import type {
  Capture,
  ClientInfo,
  GenerateMeditationInput,
  Locale,
} from '../lib/types-meditation';

export type PipelinePhase = 'idle' | 'starting' | 'script' | 'streaming' | 'ready' | 'error';

export type VibeProgress = {
  phase: PipelinePhase;
  error: string | null;
  startedAt: number | null;
};

export const ALL_VIBES: readonly Vibe[] = ['raw', 'cosmic', 'iron', 'sleep', 'zen'] as const;

const idleSlot = (): VibeProgress => ({ phase: 'idle', error: null, startedAt: null });

type State = Record<Vibe, VibeProgress>;

const KEY = 'kokoro_meditation_progress';

// Any phase that requires a live NDJSON stream to advance is a lie after a
// reload — the fetch is dead and `ready` will never land. Demote them to
// `error` on rehydrate so the card stays visible with a clean retry button
// instead of spinning forever. Terminal phases (`idle`, `ready`, `error`)
// survive untouched.
const rehydratePhase = (slot: VibeProgress): VibeProgress => {
  if (slot.phase === 'starting' || slot.phase === 'script' || slot.phase === 'streaming') {
    return { ...slot, phase: 'error', error: 'interrupted' };
  }
  return slot;
};

const blankState = (): State => ({
  raw: idleSlot(),
  cosmic: idleSlot(),
  iron: idleSlot(),
  sleep: idleSlot(),
  zen: idleSlot(),
});

const loadState = (): State => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw) as Partial<State>;
    const next = blankState();
    for (const vibe of ALL_VIBES) {
      const slot = parsed[vibe];
      if (slot && typeof slot === 'object' && 'phase' in slot) {
        next[vibe] = rehydratePhase({
          phase: slot.phase as PipelinePhase,
          error: typeof slot.error === 'string' ? slot.error : null,
          startedAt: typeof slot.startedAt === 'number' ? slot.startedAt : null,
        });
      }
    }
    return next;
  } catch {
    return blankState();
  }
};

let state: State = loadState();
const subs = new Set<() => void>();

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const getSnapshot = () => state;

const persist = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* session storage unavailable */
  }
};

const setVibe = (vibe: Vibe, next: Partial<VibeProgress>) => {
  state = { ...state, [vibe]: { ...state[vibe], ...next } };
  persist();
  subs.forEach((fn) => fn());
};

export function useMeditationProgress() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const meditationProgressApi = {
  reset: () => {
    state = blankState();
    persist();
    subs.forEach((fn) => fn());
  },
  getSnapshot,
};

const inFlight: Map<Vibe, Promise<void>> = new Map();

const resolveLocale = (): Locale => {
  const tgLang = tgUser()?.language_code?.toLowerCase();
  if (tgLang?.startsWith('ru')) return 'ru';
  if (tgLang?.startsWith('en')) return 'en';
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
};

const buildClientInfo = (): ClientInfo => {
  const user = tgUser();
  if (user) {
    return {
      source: 'telegram',
      tgUserId: user.id,
      tgUsername: user.username,
      tgFirstName: user.first_name,
      tgLanguageCode: user.language_code,
      tgIsPremium: user.is_premium,
      tgInitData: tgInitData() || undefined,
    };
  }
  return { source: isInTelegram() ? 'telegram' : 'web' };
};

// Fires the pipeline for one specific vibe. Idempotent while a previous run
// for the same vibe is still in flight. `recordedBlob` is passed explicitly
// so the multi-vibe flow can hand the recording to the picked vibe only and
// let the other 4 fall back to text/theme.
export function kickoffMeditationFor(
  vibe: Vibe,
  answers: Answers,
  recordedBlob: Blob | null = null,
): void {
  if (inFlight.has(vibe)) return;

  setVibe(vibe, { phase: 'starting', error: null, startedAt: Date.now() });

  const carry = answers.carry.trim();

  const fallbackCapture: Capture = carry
    ? { kind: 'text', text: carry }
    : { kind: 'theme', chips: answers.chips.length ? answers.chips : ['tired'] };

  const buildCaptureWithUpload = async (): Promise<Capture> => {
    if (!recordedBlob || !carry) return fallbackCapture;
    try {
      const upload = await uploadCapture(recordedBlob);
      return {
        kind: 'voice',
        audioUrl: upload.audioUrl,
        mimeType: upload.mimeType,
        transcribedText: carry,
      };
    } catch {
      return fallbackCapture;
    }
  };

  const isTransientStreamError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err || '');
    // Suno hiccups, Railway proxy resets, and any other unhandled exception
    // on the backend all surface as `stream INTERNAL: {...}`. They're usually
    // not deterministic — a silent retry recovers most of the time.
    if (msg.startsWith('stream INTERNAL')) return true;
    if (msg.startsWith('stream UPSTREAM_TIMEOUT')) return true;
    return false;
  };

  const runOnce = async (input: GenerateMeditationInput): Promise<void> => {
    let scriptVibe: Vibe = vibe;
    let templateId = '';
    let lyrics = '';
    let style = '';
    let generatedAt = '';
    let scriptMeditationId = '';

    for await (const ev of generateMeditationStreaming(input)) {
      if (ev.event === 'script') {
        scriptMeditationId = ev.meditationId;
        scriptVibe = ev.vibe;
        templateId = ev.templateId;
        lyrics = ev.lyrics;
        style = ev.style;
        generatedAt = ev.generatedAt;
        setVibe(vibe, { phase: 'script' });
      } else if (ev.event === 'streaming') {
        generatedMeditationApi.setForVibe(vibe, {
          meditationId: ev.meditationId || scriptMeditationId,
          audioUrl: '',
          streamAudioUrl: ev.streamAudioUrl,
          durationSec: ev.durationSec,
          style,
          lyrics,
          vibe: scriptVibe,
          templateId,
          generatedAt,
          providerMeta: {
            llm: { provider: '', model: '', latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
            audio: { provider: '', jobId: '', latencyMs: 0, candidates: 0, chosenCandidate: 0 },
            persistence: { provider: '', latencyMs: 0 },
            totalLatencyMs: 0,
          },
        });
        setVibe(vibe, { phase: 'streaming' });
      } else if (ev.event === 'ready') {
        generatedMeditationApi.updateForVibe(vibe, {
          audioUrl: ev.audioUrl,
          durationSec: ev.durationSec,
          providerMeta: ev.providerMeta,
        });
        setVibe(vibe, { phase: 'ready' });
        // Auto-add to the library now that the final persisted audioUrl exists.
        // saveToLibrary dedupes by meditationId; swallow errors so a library
        // hiccup never breaks generation.
        const readyId = generatedMeditationApi.getByVibeSnapshot()[vibe]?.meditationId;
        if (readyId) void libraryApi.save(readyId).catch(() => {});
      }
    }
  };

  const promise = (async () => {
    try {
      const capture = await buildCaptureWithUpload();

      const baseInput: GenerateMeditationInput = {
        callMe: answers.callMe.trim() || 'friend',
        realName: answers.realName?.trim() || undefined,
        capture,
        vibe,
        locale: resolveLocale(),
        requestId: makeRequestId(),
        client: buildClientInfo(),
      };

      try {
        await runOnce(baseInput);
      } catch (err) {
        if (!isTransientStreamError(err)) throw err;
        // Silent retry once with a fresh requestId. Keep UI in 'starting'
        // so the user doesn't see the failure flash.
        setVibe(vibe, { phase: 'starting', error: null });
        await new Promise((r) => setTimeout(r, 1500));
        await runOnce({ ...baseInput, requestId: makeRequestId() });
      }
    } catch (err: unknown) {
      setVibe(vibe, {
        phase: 'error',
        error: friendlyApiError(err),
      });
    } finally {
      inFlight.delete(vibe);
    }
  })();

  inFlight.set(vibe, promise);
}

// Fires all 5 vibes. Picked vibe goes immediately; the other 4 follow with
// a 1s head-start delay so the picked one tends to win the race through
// the LLM + Suno queue without paying a hard-sequential wait. The recorded
// blob (if any) is handed to the picked vibe only; the other 4 use the
// text/theme fallback.
export function kickoffAllMeditations(answers: Answers, pickedVibe: Vibe | ''): void {
  const picked: Vibe = pickedVibe || 'zen';
  const others = ALL_VIBES.filter((v) => v !== picked);
  const recorded = captureAudioApi.take();

  kickoffMeditationFor(picked, answers, recorded);

  window.setTimeout(() => {
    for (const v of others) kickoffMeditationFor(v, answers, null);
  }, 1000);
}

// Backwards-compat wrapper for any caller that still expects the
// single-meditation kickoff (e.g. PickWhatLands' direct-nav fallback or
// the orphaned Composing.tsx).
export function kickoffMeditation(answers: Answers): void {
  kickoffAllMeditations(answers, answers.vibe || 'zen');
}
