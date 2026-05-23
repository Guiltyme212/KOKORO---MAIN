export type ProviderTranscription = {
  provider: string;
  latencyMs: number;
  confidence: number;
};

export type ProviderLlm = {
  provider: string;
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
};

export type ProviderAudio = {
  provider: string;
  jobId: string;
  latencyMs: number;
  candidates: number;
  chosenCandidate: number;
};

export type ProviderPersistence = { provider: string; latencyMs: number };

export type ProviderMeta = {
  transcription?: ProviderTranscription;
  llm: ProviderLlm;
  audio: ProviderAudio;
  persistence: ProviderPersistence;
  totalLatencyMs: number;
};

export const emptyProviderMeta = (): ProviderMeta => ({
  llm: {
    provider: "",
    model: "",
    latencyMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
  },
  audio: {
    provider: "",
    jobId: "",
    latencyMs: 0,
    candidates: 0,
    chosenCandidate: 0,
  },
  persistence: { provider: "", latencyMs: 0 },
  totalLatencyMs: 0,
});
