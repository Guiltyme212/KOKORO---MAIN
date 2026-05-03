// Mirror of api/src/kokoro_api/types.py. Update both when changing.
// JSON wire format is camelCase via Pydantic alias_generator.

export type Mode = 'soft' | 'sharp';
export type ContentType = 'unwind' | 'attract' | 'lockin';
export type VoiceId = 'mira' | 'brad' | 'aiko' | 'sage';
export type Becoming =
  | 'calm'
  | 'sleep'
  | 'focus'
  | 'detachment'
  | 'confidence'
  | 'softness'
  | 'power'
  | 'future'
  | 'action';
export type Locale = 'en' | 'ru';

export type Capture =
  | { kind: 'voice'; audioUrl: string; mimeType: string }
  | { kind: 'text'; text: string }
  | { kind: 'theme'; chips: string[] };

export type GenerateMeditationInput = {
  callMe: string;
  realName?: string;
  mode: Mode;
  capture: Capture;
  contentType: ContentType;
  becoming?: Becoming;
  voiceId: VoiceId;
  history?: { previousScripts?: string[]; lastBecoming?: string };
  locale: Locale;
  requestId: string;
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
  script: string;
  templateUsedId: string;
  generatedAt: string;
  providerMeta: ProviderMeta;
};
