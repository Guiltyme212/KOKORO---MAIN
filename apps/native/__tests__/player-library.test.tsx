// Integration-level test for the player/library/home contract: ensures the
// library use case + Zustand stores honor the round-trip the screens depend
// on, without rendering the screens themselves (expo-audio/router need the
// device runtime).

import { buildLibraryItem } from "@application/use-cases/save-to-library";
import type { Answers } from "@domain/answers/answers";
import type { GenerateMeditationOutput } from "@domain/meditation/generate-meditation";
import { libraryApi } from "@infrastructure/api/library";
import { localLibraryRepository } from "@infrastructure/storage/local-library.repository";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";

const baseAnswers: Answers = {
  callMe: "Babe",
  realName: "Alice",
  carry: "I'm tired",
  chips: [],
  vibe: "",
};

const generated: GenerateMeditationOutput = {
  meditationId: "m-player",
  audioUrl: "https://x.test/final.mp3",
  durationSec: 60,
  style: "S",
  lyrics: "L",
  vibe: "zen",
  templateId: "t",
  generatedAt: "2026-05-23T10:00:00Z",
  providerMeta: {
    llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
    audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
    persistence: { provider: "", latencyMs: 0 },
    totalLatencyMs: 0,
  },
};

beforeEach(async () => {
  useGeneratedMeditationStore.getState().reset();
  await localLibraryRepository.clear();
});

describe("Player → save → Library round-trip", () => {
  it("saves a buildLibraryItem and reads it back from the library port", async () => {
    const item = buildLibraryItem(generated, baseAnswers);
    const saved = await libraryApi.save(item);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.meditationId).toBe("m-player");

    const listed = await libraryApi.list();
    expect(listed.map((row) => row.meditationId)).toEqual(["m-player"]);
  });

  it("Library list returns empty when nothing saved", async () => {
    expect(await libraryApi.list()).toEqual([]);
  });

  it("selecting a library item promotes it to the generated.current store", async () => {
    useGeneratedMeditationStore.getState().setForVibe("zen", generated);
    useGeneratedMeditationStore.getState().selectVibeAsCurrent("zen");
    expect(useGeneratedMeditationStore.getState().current?.meditationId).toBe("m-player");
  });

  it("removing a library item drops it from subsequent list()", async () => {
    const item = buildLibraryItem(generated, baseAnswers);
    await libraryApi.save(item);
    await libraryApi.remove("m-player");
    expect(await libraryApi.list()).toEqual([]);
  });
});
