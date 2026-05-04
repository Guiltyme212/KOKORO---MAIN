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
};

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
