import type { ProviderMeta } from "./provider-meta";
import type { Vibe } from "./vibe";

export type StreamScriptEvent = {
  event: "script";
  meditationId: string;
  lyrics: string;
  style: string;
  vibe: Vibe;
  templateId: string;
  generatedAt: string;
};

export type StreamStreamingEvent = {
  event: "streaming";
  meditationId: string;
  streamAudioUrl: string;
  durationSec: number;
};

export type StreamReadyEvent = {
  event: "ready";
  meditationId: string;
  audioUrl: string;
  durationSec: number;
  providerMeta: ProviderMeta;
};

export type StreamErrorEvent = {
  event: "error";
  error: string;
  details: Record<string, unknown>;
};

export type StreamEvent =
  | StreamScriptEvent
  | StreamStreamingEvent
  | StreamReadyEvent
  | StreamErrorEvent;

export const isScriptEvent = (ev: StreamEvent): ev is StreamScriptEvent => ev.event === "script";
export const isStreamingEvent = (ev: StreamEvent): ev is StreamStreamingEvent =>
  ev.event === "streaming";
export const isReadyEvent = (ev: StreamEvent): ev is StreamReadyEvent => ev.event === "ready";
export const isErrorEvent = (ev: StreamEvent): ev is StreamErrorEvent => ev.event === "error";

// Transient stream errors are retriable: a fresh requestId usually clears them.
export const isTransientStreamError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.startsWith("stream INTERNAL") || msg.startsWith("stream UPSTREAM_TIMEOUT");
};
