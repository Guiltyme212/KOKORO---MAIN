import AsyncStorage from "@react-native-async-storage/async-storage";

import { ANSWERS_DEFAULT } from "@domain/answers/answers";
import { PERSONA_DEFAULT, addTheme } from "@domain/persona/persona";
import type { LibraryItem } from "@domain/library/library-item";

import { answersRepository } from "./answers.repository";
import { personaRepository } from "./persona.repository";
import { authRepository } from "./auth.repository";
import { localLibraryRepository } from "./local-library.repository";
import { generatedMeditationRepository } from "./generated-meditation.repository";

const sampleItem: LibraryItem = {
  meditationId: "m-1",
  audioUrl: "https://x.test/a.mp3",
  durationSec: 60,
  callMe: "friend",
  vibe: "zen",
  savedAt: "2026-05-23T10:00:00Z",
  generatedAt: "2026-05-23T10:00:00Z",
};

beforeEach(async () => {
  await Promise.all([
    answersRepository.clear(),
    personaRepository.clear(),
    authRepository.clear(),
    localLibraryRepository.clear(),
    generatedMeditationRepository.clear(),
  ]);
});

describe("answers repository", () => {
  it("returns the default when nothing is stored", async () => {
    expect(await answersRepository.read()).toEqual(ANSWERS_DEFAULT);
  });

  it("round-trips a written value", async () => {
    await answersRepository.write({ ...ANSWERS_DEFAULT, callMe: "Babe" });
    expect((await answersRepository.read()).callMe).toBe("Babe");
  });
});

describe("persona repository", () => {
  it("merges the stored value over the default", async () => {
    const next = addTheme(PERSONA_DEFAULT, "work");
    await personaRepository.write(next);
    expect((await personaRepository.read()).themes).toBe("work");
  });

  it("falls back when stored JSON is corrupted", async () => {
    await AsyncStorage.setItem("kokoro_persona", "not json {");
    expect(await personaRepository.read()).toEqual(PERSONA_DEFAULT);
  });
});

describe("local library repository", () => {
  it("starts empty", async () => {
    expect(await localLibraryRepository.list()).toEqual([]);
  });

  it("save dedupes by meditationId and keeps newest first", async () => {
    const a = { ...sampleItem, meditationId: "a", savedAt: "2026-01-01T00:00:00Z" };
    const b = { ...sampleItem, meditationId: "b", savedAt: "2026-02-01T00:00:00Z" };
    const aPrime = { ...a, savedAt: "2026-03-01T00:00:00Z" };
    await localLibraryRepository.save(a);
    await localLibraryRepository.save(b);
    const final = await localLibraryRepository.save(aPrime);
    expect(final.map((x) => x.meditationId)).toEqual(["a", "b"]);
  });

  it("remove drops the targeted id", async () => {
    await localLibraryRepository.save(sampleItem);
    const after = await localLibraryRepository.remove(sampleItem.meditationId);
    expect(after).toEqual([]);
  });

  it("isSaved reflects the persisted set", async () => {
    expect(await localLibraryRepository.isSaved(sampleItem.meditationId)).toBe(false);
    await localLibraryRepository.save(sampleItem);
    expect(await localLibraryRepository.isSaved(sampleItem.meditationId)).toBe(true);
  });
});

describe("generated meditation repository", () => {
  it("current round-trips and clears", async () => {
    expect(await generatedMeditationRepository.readCurrent()).toBeNull();
    await generatedMeditationRepository.writeCurrent({
      meditationId: "m",
      audioUrl: "x",
      durationSec: 1,
      style: "",
      lyrics: "",
      vibe: "zen",
      templateId: "",
      generatedAt: "",
      providerMeta: {
        llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
        audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
        persistence: { provider: "", latencyMs: 0 },
        totalLatencyMs: 0,
      },
    });
    const back = await generatedMeditationRepository.readCurrent();
    expect(back?.meditationId).toBe("m");
    await generatedMeditationRepository.writeCurrent(null);
    expect(await generatedMeditationRepository.readCurrent()).toBeNull();
  });

  it("byVibe round-trips a partial record", async () => {
    await generatedMeditationRepository.writeByVibe({
      zen: {
        meditationId: "z",
        audioUrl: "",
        durationSec: 0,
        style: "",
        lyrics: "",
        vibe: "zen",
        templateId: "",
        generatedAt: "",
        providerMeta: {
          llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
          audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
          persistence: { provider: "", latencyMs: 0 },
          totalLatencyMs: 0,
        },
      },
    });
    const back = await generatedMeditationRepository.readByVibe();
    expect(back.zen?.meditationId).toBe("z");
    expect(back.raw).toBeUndefined();
  });
});
