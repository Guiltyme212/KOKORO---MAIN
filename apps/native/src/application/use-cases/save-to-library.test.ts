import type { Answers } from "@domain/answers/answers";
import type { GenerateMeditationOutput } from "@domain/meditation/generate-meditation";
import { LibraryError, buildLibraryItem, saveToLibrary } from "./save-to-library";

const baseAnswers: Answers = {
  callMe: "Babe",
  realName: "Alice",
  carry: "",
  chips: [],
  vibe: "",
};

const baseGenerated: GenerateMeditationOutput = {
  meditationId: "m-1",
  audioUrl: "https://x.test/a.mp3",
  durationSec: 60,
  style: "",
  lyrics: "",
  vibe: "zen",
  templateId: "",
  generatedAt: "2026-05-23T10:00:00Z",
  providerMeta: {
    llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
    audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
    persistence: { provider: "", latencyMs: 0 },
    totalLatencyMs: 0,
  },
};

describe("buildLibraryItem", () => {
  it("uses audioUrl when present, falls back to streamAudioUrl", () => {
    expect(buildLibraryItem(baseGenerated, baseAnswers).audioUrl).toBe(baseGenerated.audioUrl);

    const streaming = { ...baseGenerated, audioUrl: "", streamAudioUrl: "https://x.test/stream.mp3" };
    expect(buildLibraryItem(streaming, baseAnswers).audioUrl).toBe(streaming.streamAudioUrl);
  });

  it("throws LibraryError when neither URL exists", () => {
    const naked = { ...baseGenerated, audioUrl: "" };
    expect(() => buildLibraryItem(naked, baseAnswers)).toThrow(LibraryError);
  });

  it("uses callMe → realName → 'friend' fallback", () => {
    expect(buildLibraryItem(baseGenerated, { ...baseAnswers, callMe: "" }).callMe).toBe("Alice");
    expect(
      buildLibraryItem(baseGenerated, { ...baseAnswers, callMe: "", realName: undefined }).callMe,
    ).toBe("friend");
  });
});

describe("saveToLibrary", () => {
  it("delegates to LibraryPort.save", async () => {
    const library = {
      list: jest.fn(),
      save: jest.fn(async (item) => [item]),
      remove: jest.fn(),
      isSaved: jest.fn(),
    };
    const item = buildLibraryItem(baseGenerated, baseAnswers);
    const out = await saveToLibrary({ library })(item);
    expect(library.save).toHaveBeenCalledWith(item);
    expect(out).toEqual([item]);
  });
});
