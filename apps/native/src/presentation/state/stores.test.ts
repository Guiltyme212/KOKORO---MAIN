// Stores are pure JS state — we don't need React's act() since no
// components are mounted. Calling setters directly is fine.
const act = (fn: () => void) => fn();

import { useAnswersStore } from "./use-answers.store";
import { usePersonaStore } from "./use-persona.store";
import { useAuthStore } from "./use-auth.store";
import { useMeditationProgressStore } from "./use-meditation-progress.store";
import { useGeneratedMeditationStore } from "./use-generated-meditation.store";

beforeEach(() => {
  act(() => {
    useAnswersStore.getState().reset();
    usePersonaStore.getState().reset();
    useAuthStore.getState().signOut();
    useMeditationProgressStore.getState().reset();
    useGeneratedMeditationStore.getState().reset();
  });
});

describe("useAnswersStore", () => {
  it("setAnswer mutates exactly one key", () => {
    act(() => useAnswersStore.getState().setAnswer("callMe", "Babe"));
    expect(useAnswersStore.getState().answers.callMe).toBe("Babe");
    expect(useAnswersStore.getState().answers.carry).toBe("");
  });
});

describe("usePersonaStore", () => {
  it("addTheme applies the domain rule", () => {
    act(() => usePersonaStore.getState().addTheme("work"));
    act(() => usePersonaStore.getState().addTheme("WORK"));
    expect(usePersonaStore.getState().persona.themes).toBe("WORK");
  });

  it("recordMeditation prepends and caps at 3", () => {
    act(() => {
      const s = usePersonaStore.getState();
      s.recordMeditation({ vibe: "zen" });
      s.recordMeditation({ vibe: "raw" });
      s.recordMeditation({ vibe: "iron" });
      s.recordMeditation({ vibe: "sleep" });
    });
    expect(
      usePersonaStore.getState().persona.meditations.split(";").map((s) => s.trim()).length,
    ).toBe(3);
  });
});

describe("useAuthStore", () => {
  it("setAppleAccount tracks lastProvider", () => {
    act(() =>
      useAuthStore.getState().setAppleAccount({ userId: "u", email: "a@b.test" }),
    );
    expect(useAuthStore.getState().auth.lastProvider).toBe("apple");
  });
});

describe("useMeditationProgressStore", () => {
  it("setVibe updates a single slot", () => {
    act(() =>
      useMeditationProgressStore
        .getState()
        .setVibe("zen", { phase: "streaming", error: null, startedAt: 1 }),
    );
    expect(useMeditationProgressStore.getState().progress.zen.phase).toBe("streaming");
    expect(useMeditationProgressStore.getState().progress.raw.phase).toBe("idle");
  });
});

describe("useGeneratedMeditationStore", () => {
  it("setForVibe + selectVibeAsCurrent promotes a record", () => {
    act(() => {
      useGeneratedMeditationStore.getState().setForVibe("zen", {
        meditationId: "z",
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
    });
    expect(useGeneratedMeditationStore.getState().byVibe.zen?.meditationId).toBe("z");

    act(() => useGeneratedMeditationStore.getState().selectVibeAsCurrent("zen"));
    expect(useGeneratedMeditationStore.getState().current?.meditationId).toBe("z");
  });
});
