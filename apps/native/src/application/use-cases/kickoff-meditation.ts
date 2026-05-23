import type { Answers } from "@domain/answers/answers";
import type { Capture } from "@domain/meditation/capture";
import type {
  ClientInfo,
  GenerateMeditationInput,
  Locale,
} from "@domain/meditation/generate-meditation";
import type { GenerateMeditationOutput } from "@domain/meditation/generate-meditation";
import type { PipelinePhase, VibeProgress } from "@domain/pipeline/phase";
import type { Vibe } from "@domain/meditation/vibe";
import type { MeditationApiPort } from "@application/ports/meditation-api.port";
import type { UploadsPort, CaptureBlob } from "@application/ports/uploads.port";
import { emptyProviderMeta } from "@domain/meditation/provider-meta";
import {
  isReadyEvent,
  isScriptEvent,
  isStreamingEvent,
  isTransientStreamError,
} from "@domain/meditation/stream-event";

export type ProgressSink = {
  setVibeProgress(vibe: Vibe, partial: Partial<VibeProgress>): void;
};

export type GeneratedSink = {
  setForVibe(vibe: Vibe, value: GenerateMeditationOutput): void;
  updateForVibe(vibe: Vibe, partial: Partial<GenerateMeditationOutput>): void;
};

export type KickoffDeps = {
  meditationApi: MeditationApiPort;
  uploads: UploadsPort;
  progress: ProgressSink;
  generated: GeneratedSink;
  // Injectable for tests:
  makeRequestId: () => string;
  delay: (ms: number) => Promise<void>;
};

export type KickoffArgs = {
  vibe: Vibe;
  answers: Answers;
  recordedBlob: CaptureBlob | null;
  locale: Locale;
  client?: ClientInfo;
};

const friendlyError = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (msg.startsWith("stream UPSTREAM_TIMEOUT") || msg.startsWith("api 504"))
    return "Kokoro's audio service is taking too long. Try again in a moment.";
  if (msg.startsWith("stream UPSTREAM_RATE_LIMIT") || msg.startsWith("api 429"))
    return "Kokoro's audio service is busy. Give it about 30 seconds, then try again.";
  if (msg.startsWith("stream AUDIO_GEN_FAILED") || msg.startsWith("api 422"))
    return "Kokoro couldn't finish the audio for that one. Try again.";
  if (msg.startsWith("stream INTERNAL") || msg.startsWith("api 500"))
    return "Something hiccuped on Kokoro's side. Tap Try again.";
  if (msg.includes("Network request failed") || msg.includes("Failed to fetch"))
    return "Could not reach Kokoro's server.";
  return msg || "Something went wrong.";
};

export const makeKickoffMeditation = (deps: KickoffDeps) => {
  const inFlight = new Map<Vibe, Promise<void>>();

  const buildCapture = async (
    answers: Answers,
    recordedBlob: CaptureBlob | null,
  ): Promise<Capture> => {
    const carry = answers.carry.trim();
    const fallback: Capture = carry
      ? { kind: "text", text: carry }
      : { kind: "theme", chips: answers.chips.length ? answers.chips : ["tired"] };
    if (!recordedBlob || !carry) return fallback;
    try {
      const upload = await deps.uploads.uploadCapture(recordedBlob);
      return {
        kind: "voice",
        audioUrl: upload.audioUrl,
        mimeType: upload.mimeType,
        transcribedText: carry,
      };
    } catch {
      return fallback;
    }
  };

  const runOnce = async (vibe: Vibe, input: GenerateMeditationInput): Promise<void> => {
    let scriptMeta = {
      vibe,
      templateId: "",
      lyrics: "",
      style: "",
      generatedAt: "",
      meditationId: "",
    };
    const handle = deps.meditationApi.stream(input);

    for await (const ev of handle.events) {
      if (isScriptEvent(ev)) {
        scriptMeta = {
          vibe: ev.vibe,
          templateId: ev.templateId,
          lyrics: ev.lyrics,
          style: ev.style,
          generatedAt: ev.generatedAt,
          meditationId: ev.meditationId,
        };
        deps.progress.setVibeProgress(vibe, { phase: "script" });
      } else if (isStreamingEvent(ev)) {
        deps.generated.setForVibe(vibe, {
          meditationId: ev.meditationId || scriptMeta.meditationId,
          audioUrl: "",
          streamAudioUrl: ev.streamAudioUrl,
          durationSec: ev.durationSec,
          style: scriptMeta.style,
          lyrics: scriptMeta.lyrics,
          vibe: scriptMeta.vibe,
          templateId: scriptMeta.templateId,
          generatedAt: scriptMeta.generatedAt,
          providerMeta: emptyProviderMeta(),
        });
        deps.progress.setVibeProgress(vibe, { phase: "streaming" });
      } else if (isReadyEvent(ev)) {
        deps.generated.updateForVibe(vibe, {
          audioUrl: ev.audioUrl,
          durationSec: ev.durationSec,
          providerMeta: ev.providerMeta,
        });
        deps.progress.setVibeProgress(vibe, { phase: "ready" });
      }
    }
  };

  // Per-vibe idempotency: if a run is in-flight for this vibe, return its
  // existing promise instead of stacking duplicates.
  const kickoff = (args: KickoffArgs): Promise<void> => {
    const existing = inFlight.get(args.vibe);
    if (existing) return existing;

    const run = (async () => {
      deps.progress.setVibeProgress(args.vibe, {
        phase: "starting" as PipelinePhase,
        error: null,
        startedAt: Date.now(),
      });

      try {
        const capture = await buildCapture(args.answers, args.recordedBlob);
        const baseInput: GenerateMeditationInput = {
          callMe: args.answers.callMe.trim() || "friend",
          realName: args.answers.realName?.trim() || undefined,
          capture,
          vibe: args.vibe,
          locale: args.locale,
          requestId: deps.makeRequestId(),
          client: args.client,
        };

        try {
          await runOnce(args.vibe, baseInput);
        } catch (err) {
          if (!isTransientStreamError(err)) throw err;
          deps.progress.setVibeProgress(args.vibe, { phase: "starting", error: null });
          await deps.delay(1500);
          await runOnce(args.vibe, { ...baseInput, requestId: deps.makeRequestId() });
        }
      } catch (err) {
        deps.progress.setVibeProgress(args.vibe, {
          phase: "error",
          error: friendlyError(err),
        });
      } finally {
        inFlight.delete(args.vibe);
      }
    })();

    inFlight.set(args.vibe, run);
    return run;
  };

  return { kickoff, inFlight };
};
