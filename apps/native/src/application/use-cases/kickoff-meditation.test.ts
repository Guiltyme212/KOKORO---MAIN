import type { Answers } from "@domain/answers/answers";
import type { GenerateMeditationOutput } from "@domain/meditation/generate-meditation";
import type { Vibe } from "@domain/meditation/vibe";
import type { VibeProgress } from "@domain/pipeline/phase";
import type { StreamEvent } from "@domain/meditation/stream-event";
import type {
  MeditationApiPort,
  MeditationStreamHandle,
} from "@application/ports/meditation-api.port";
import type { UploadsPort } from "@application/ports/uploads.port";

import { makeKickoffMeditation, type GeneratedSink, type ProgressSink } from "./kickoff-meditation";

const baseAnswers: Answers = {
  callMe: "Babe",
  realName: "Alice",
  carry: "I'm tired",
  chips: [],
  vibe: "",
};

const arrayStream = (events: StreamEvent[], error?: Error): MeditationStreamHandle => ({
  events: (async function* () {
    for (const ev of events) yield ev;
    if (error) throw error;
  })(),
  cancel: () => {},
});

const setupProgress = (): { sink: ProgressSink; recorded: Array<[Vibe, Partial<VibeProgress>]> } => {
  const recorded: Array<[Vibe, Partial<VibeProgress>]> = [];
  return {
    sink: { setVibeProgress: (vibe, partial) => recorded.push([vibe, partial]) },
    recorded,
  };
};

const setupGenerated = (): {
  sink: GeneratedSink;
  byVibe: Partial<Record<Vibe, GenerateMeditationOutput>>;
} => {
  const byVibe: Partial<Record<Vibe, GenerateMeditationOutput>> = {};
  return {
    sink: {
      setForVibe: (vibe, value) => {
        byVibe[vibe] = value;
      },
      updateForVibe: (vibe, partial) => {
        const existing = byVibe[vibe];
        if (existing) byVibe[vibe] = { ...existing, ...partial };
      },
    },
    byVibe,
  };
};

const happyStream: StreamEvent[] = [
  {
    event: "script",
    meditationId: "m-1",
    lyrics: "L",
    style: "S",
    vibe: "zen",
    templateId: "t-1",
    generatedAt: "2026-05-23T10:00:00Z",
  },
  {
    event: "streaming",
    meditationId: "m-1",
    streamAudioUrl: "https://x.test/stream.mp3",
    durationSec: 60,
  },
  {
    event: "ready",
    meditationId: "m-1",
    audioUrl: "https://x.test/final.mp3",
    durationSec: 60,
    providerMeta: {
      llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
      audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
      persistence: { provider: "", latencyMs: 0 },
      totalLatencyMs: 0,
    },
  },
];

describe("makeKickoffMeditation", () => {
  it("walks happy path starting → script → streaming → ready", async () => {
    const meditationApi: MeditationApiPort = {
      generate: jest.fn(),
      stream: jest.fn(() => arrayStream(happyStream)),
    };
    const uploads: UploadsPort = { uploadCapture: jest.fn() };
    const progress = setupProgress();
    const generated = setupGenerated();

    const kickoff = makeKickoffMeditation({
      meditationApi,
      uploads,
      progress: progress.sink,
      generated: generated.sink,
      makeRequestId: () => "req-1",
      delay: () => Promise.resolve(),
    });

    await kickoff.kickoff({
      vibe: "zen",
      answers: baseAnswers,
      recordedBlob: null,
      locale: "en",
    });

    const phases = progress.recorded.map(([, p]) => p.phase).filter(Boolean);
    expect(phases).toEqual(["starting", "script", "streaming", "ready"]);
    expect(generated.byVibe.zen?.audioUrl).toBe("https://x.test/final.mp3");
    expect(generated.byVibe.zen?.streamAudioUrl).toBe("https://x.test/stream.mp3");
  });

  it("is idempotent per vibe while a run is in flight", async () => {
    let streamCalls = 0;
    const meditationApi: MeditationApiPort = {
      generate: jest.fn(),
      stream: jest.fn(() => {
        streamCalls += 1;
        return arrayStream(happyStream);
      }),
    };
    const uploads: UploadsPort = { uploadCapture: jest.fn() };

    const progress = setupProgress();
    const generated = setupGenerated();

    const kickoff = makeKickoffMeditation({
      meditationApi,
      uploads,
      progress: progress.sink,
      generated: generated.sink,
      makeRequestId: () => "req-1",
      delay: () => Promise.resolve(),
    });

    const args = { vibe: "zen" as Vibe, answers: baseAnswers, recordedBlob: null, locale: "en" as const };
    const a = kickoff.kickoff(args);
    const b = kickoff.kickoff(args);
    expect(a).toBe(b);
    await a;
    expect(streamCalls).toBe(1);
  });

  it("retries once on a transient stream INTERNAL error", async () => {
    let stage = 0;
    const meditationApi: MeditationApiPort = {
      generate: jest.fn(),
      stream: jest.fn(() => {
        stage += 1;
        if (stage === 1) {
          return arrayStream([], new Error("stream INTERNAL: blip"));
        }
        return arrayStream(happyStream);
      }),
    };
    const uploads: UploadsPort = { uploadCapture: jest.fn() };
    const progress = setupProgress();
    const generated = setupGenerated();

    const kickoff = makeKickoffMeditation({
      meditationApi,
      uploads,
      progress: progress.sink,
      generated: generated.sink,
      makeRequestId: () => "req-1",
      delay: () => Promise.resolve(),
    });

    await kickoff.kickoff({
      vibe: "zen",
      answers: baseAnswers,
      recordedBlob: null,
      locale: "en",
    });

    expect(meditationApi.stream).toHaveBeenCalledTimes(2);
    const phases = progress.recorded.map(([, p]) => p.phase).filter(Boolean);
    expect(phases).toContain("ready");
  });

  it("records a friendly error on non-transient failure", async () => {
    const meditationApi: MeditationApiPort = {
      generate: jest.fn(),
      stream: jest.fn(() => arrayStream([], new Error("api 422: AUDIO_GEN_FAILED"))),
    };
    const uploads: UploadsPort = { uploadCapture: jest.fn() };
    const progress = setupProgress();
    const generated = setupGenerated();

    const kickoff = makeKickoffMeditation({
      meditationApi,
      uploads,
      progress: progress.sink,
      generated: generated.sink,
      makeRequestId: () => "req-1",
      delay: () => Promise.resolve(),
    });

    await kickoff.kickoff({
      vibe: "zen",
      answers: baseAnswers,
      recordedBlob: null,
      locale: "en",
    });

    const last = progress.recorded.at(-1)?.[1];
    expect(last?.phase).toBe("error");
    expect(typeof last?.error).toBe("string");
  });

  it("uploads the blob when both blob and carry text are present", async () => {
    const captureSent: { kind?: string } = {};
    const meditationApi: MeditationApiPort = {
      generate: jest.fn(),
      stream: jest.fn((input) => {
        captureSent.kind = (input.capture as { kind: string }).kind;
        return arrayStream(happyStream);
      }),
    };
    const uploads: UploadsPort = {
      uploadCapture: jest.fn(async () => ({
        audioUrl: "https://x.test/uploaded.m4a",
        key: "k",
        mimeType: "audio/m4a",
      })),
    };
    const progress = setupProgress();
    const generated = setupGenerated();

    const kickoff = makeKickoffMeditation({
      meditationApi,
      uploads,
      progress: progress.sink,
      generated: generated.sink,
      makeRequestId: () => "req-1",
      delay: () => Promise.resolve(),
    });

    await kickoff.kickoff({
      vibe: "raw",
      answers: baseAnswers,
      recordedBlob: { uri: "file://capture.m4a", mimeType: "audio/m4a" },
      locale: "en",
    });

    expect(captureSent.kind).toBe("voice");
    expect(uploads.uploadCapture).toHaveBeenCalledTimes(1);
  });
});
