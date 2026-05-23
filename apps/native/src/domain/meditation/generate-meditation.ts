import type { Capture } from "./capture";
import type { ProviderMeta } from "./provider-meta";
import type { Vibe } from "./vibe";

export type Locale = "en" | "ru";

export type ClientSource = "telegram" | "web" | "native";

export type ClientInfo = {
  source: ClientSource;
  tgUserId?: number;
  tgUsername?: string;
  tgFirstName?: string;
  tgLanguageCode?: string;
  tgIsPremium?: boolean;
  tgInitData?: string;
};

export type GenerateMeditationInput = {
  callMe: string;
  realName?: string;
  capture: Capture;
  vibe: Vibe;
  history?: { previousScripts?: string[]; lastVibe?: Vibe };
  locale: Locale;
  requestId: string;
  client?: ClientInfo;
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
  streamAudioUrl?: string;
};
