import { z } from 'zod';

export const ModeSchema = z.enum(['soft', 'sharp']);
export const ContentTypeSchema = z.enum(['unwind', 'attract', 'lockin']);
export const VoiceIdSchema = z.enum(['mira', 'brad', 'aiko', 'sage']);
export const BecomingSchema = z.enum([
  'calm','sleep','focus','detachment','confidence','softness','power','future','action',
]);
export const LocaleSchema = z.enum(['en', 'ru']);

export const CaptureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('voice'), audioUrl: z.string().url(), mimeType: z.string() }),
  z.object({ kind: z.literal('text'),  text: z.string().min(1).max(2000) }),
  z.object({ kind: z.literal('theme'), chips: z.array(z.string()).min(1).max(6) }),
]);

export const GenerateMeditationInputSchema = z.object({
  callMe: z.string().min(1).max(24).regex(/^[^\n\r]+$/),
  realName: z.string().max(60).optional(),
  mode: ModeSchema,
  capture: CaptureSchema,
  contentType: ContentTypeSchema,
  becoming: BecomingSchema.optional(),
  voiceId: VoiceIdSchema,
  history: z.object({
    previousScripts: z.array(z.string()).max(2).optional(),
    lastBecoming: z.string().optional(),
  }).optional(),
  locale: LocaleSchema,
  requestId: z.string().uuid(),
});

export type GenerateMeditationInput = z.infer<typeof GenerateMeditationInputSchema>;

export type ScriptBeat = {
  startSec: number;
  durationSec: number;
  text: string;
  type: 'opening' | 'line' | 'breath' | 'pause' | 'closing';
};

export type ProviderMeta = {
  transcription?: { provider: string; latencyMs: number; confidence: number };
  llm: { provider: string; model: string; latencyMs: number; tokensIn: number; tokensOut: number; cacheReadTokens: number };
  audio: { provider: string; jobId: string; latencyMs: number; candidates: number; chosenCandidate: number };
  persistence: { provider: string; latencyMs: number };
  totalLatencyMs: number;
};

export type GenerateMeditationOutput = {
  meditationId: string;
  audioUrl: string;
  durationSec: number;
  script: string;
  beats: ScriptBeat[];
  templateUsedId: string;
  generatedAt: string;
  providerMeta: ProviderMeta;
};

export type Template = {
  id: string;
  contentType: 'unwind' | 'attract' | 'lockin';
  modes: ('soft' | 'sharp')[];
  becomingMatch: string[];
  themeKeywords: string[];
  targetDurationSec: number;
  musicStylePrompt: string;
  referenceTrackUrls: string[];
  structure: { id: string; sec: number; intent: string }[];
  registerNotes: { soft: string; sharp: string };
};
