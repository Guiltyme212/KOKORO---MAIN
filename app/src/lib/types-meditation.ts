// Mirror of api/src/kokoro_api/types.py. Update both when changing.
// JSON wire format is camelCase via Pydantic alias_generator.

export type Vibe = 'raw' | 'cosmic' | 'iron' | 'zen' | 'sleep';
export type Locale = 'en' | 'ru';

export type Capture =
  | { kind: 'voice'; audioUrl: string; mimeType: string; transcribedText?: string }
  | { kind: 'text'; text: string }
  | { kind: 'theme'; chips: string[] };

export type UploadResponse = {
  audioUrl: string;
  key: string;
  mimeType: string;
};

export type FeedbackInput = {
  tgUserId?: number;
  liked: boolean;
};

export type ClientInfo = {
  source: 'telegram' | 'web';
  tgUserId?: number;
  tgUsername?: string;
  tgFirstName?: string;
  tgLanguageCode?: string;
  tgIsPremium?: boolean;
  tgInitData?: string; // raw signed initData; backend can HMAC-verify later
};

export type GenerateMeditationInput = {
  callMe: string;
  realName?: string;
  capture: Capture;
  vibe: Vibe;
  history?: { previousScripts?: string[] };
  locale: Locale;
  requestId: string;
  client?: ClientInfo;
};

export type ProviderMeta = {
  transcription?: { provider: string; latencyMs: number; confidence: number };
  llm: {
    provider: string;
    model: string;
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
    cacheReadTokens: number;
  };
  audio: {
    provider: string;
    jobId: string;
    latencyMs: number;
    candidates: number;
    chosenCandidate: number;
  };
  persistence: { provider: string; latencyMs: number };
  totalLatencyMs: number;
};

export type GenerateMeditationOutput = {
  meditationId: string;
  audioUrl: string;
  durationSec: number;
  style: string;
  lyrics: string;
  vibe: Vibe;
  templateId: string;
  generatedAt: string;
  providerMeta: ProviderMeta;
  // Suno's progressive-streaming MP3, available ~20-40s after submit (well
  // before the final mastered `audioUrl` is persisted). Player uses this
  // for first listen; the persisted `audioUrl` arrives later for replay.
  streamAudioUrl?: string;
};

// Mirror of api/src/kokoro_api/types.py StreamScriptEvent / StreamStreamingEvent
// / StreamReadyEvent / StreamErrorEvent. Wire format is NDJSON over
// POST /meditations/stream.
export type StreamScriptEvent = {
  event: 'script';
  meditationId: string;
  lyrics: string;
  style: string;
  vibe: Vibe;
  templateId: string;
  generatedAt: string;
};

export type StreamStreamingEvent = {
  event: 'streaming';
  meditationId: string;
  streamAudioUrl: string;
  durationSec: number;
};

export type StreamReadyEvent = {
  event: 'ready';
  meditationId: string;
  audioUrl: string;
  durationSec: number;
  providerMeta: ProviderMeta;
};

export type StreamErrorEvent = {
  event: 'error';
  error: string;
  details: Record<string, unknown>;
};

// Heartbeat the backend emits every ~10s during silent waits (LLM / Suno) so
// the long-lived NDJSON connection never goes idle and gets dropped by the
// Railway edge / iOS WKWebView. Carries no payload — its mere arrival is the point.
export type StreamPingEvent = {
  event: 'ping';
};

export type StreamEvent =
  | StreamScriptEvent
  | StreamStreamingEvent
  | StreamReadyEvent
  | StreamErrorEvent
  | StreamPingEvent;

export type LibraryItem = {
  meditationId: string;
  audioUrl: string;
  durationSec: number;
  callMe: string;
  realName?: string;
  vibe: Vibe;
  capturePreview?: string;
  savedAt: string;
  generatedAt: string;
};

export type LibraryListOutput = {
  items: LibraryItem[];
};
