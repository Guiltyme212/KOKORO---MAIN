// Thin wrapper around the browser-native Web Speech API.
// Supported in Chrome, Safari (iOS 14.5+), and the Chromium / WKWebView
// shells Telegram Mini Apps run in. Falls back to `isSupported: false` so
// callers can route to text input.

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEvent) => unknown) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => unknown) | null;
  onend: ((ev: Event) => unknown) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionAlternative = { transcript: string; confidence: number };

type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionErrorEvent = Event & { error: string };

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

import { isNative } from './native';

const ctor = (): SpeechRecognitionConstructor | null => {
  // Web Speech API is unreliable in iOS WKWebView. Force the caller's
  // fallback path (MediaRecorder upload to backend transcription) on
  // native Capacitor builds.
  if (isNative()) return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
};

export const isSttSupported = (): boolean => ctor() !== null;

export type SttHandle = {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
};

export type SttOptions = {
  lang?: string;
  continuous?: boolean;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
};

export function createStt(opts: SttOptions): SttHandle {
  const C = ctor();
  if (!C) {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  let rec: SpeechRecognitionInstance | null = null;
  let running = false;

  const ensure = (): SpeechRecognitionInstance => {
    if (rec) return rec;
    rec = new C();
    rec.continuous = opts.continuous ?? false;
    rec.interimResults = true;
    rec.lang = opts.lang ?? navigator.language ?? 'en-US';

    rec.onresult = (e) => {
      let final = '';
      let partial = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          final += (final ? ' ' : '') + text.trim();
        } else {
          partial += text;
        }
      }
      if (partial) opts.onPartial?.(partial.trim());
      if (final) opts.onFinal(final);
    };

    rec.onerror = (e) => {
      running = false;
      opts.onError?.(e.error);
    };

    rec.onend = () => {
      running = false;
    };

    return rec;
  };

  return {
    isSupported: true,
    start: () => {
      if (running) return;
      try {
        ensure().start();
        running = true;
      } catch {
        // already starting / hardware busy — best-effort, no-op
      }
    },
    stop: () => {
      if (!running || !rec) return;
      try { rec.stop(); } catch { /* ignore */ }
      running = false;
    },
  };
}
