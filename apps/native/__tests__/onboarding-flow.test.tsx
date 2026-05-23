// Onboarding logic test: drives the underlying Zustand stores the way each
// screen does, without rendering the real screens (which depend on
// expo-router + expo-video at runtime). The store transitions are what
// matter for "the port works".

import { useAnswersStore } from "@presentation/state/use-answers.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { buildWeCanPhrase } from "@domain/meditation/we-can-phrase";

beforeEach(() => {
  useAnswersStore.getState().reset();
  usePersonaStore.getState().reset();
  useMeditationProgressStore.getState().reset();
  useGeneratedMeditationStore.getState().reset();
});

describe("Onboarding flow logic", () => {
  it("Welcome → resets the four stores", () => {
    useAnswersStore.getState().setAnswer("callMe", "Babe");
    usePersonaStore.getState().addTheme("work");

    useAnswersStore.getState().reset();
    usePersonaStore.getState().reset();
    useMeditationProgressStore.getState().reset();
    useGeneratedMeditationStore.getState().reset();

    expect(useAnswersStore.getState().answers.callMe).toBe("");
    expect(usePersonaStore.getState().persona.themes).toBe("");
  });

  it("Name → writes real name + pet name to both answers and persona", () => {
    useAnswersStore.getState().setAnswer("realName", "Alice");
    useAnswersStore.getState().setAnswer("callMe", "Babe");
    usePersonaStore.getState().set({ callMe: "Babe", realName: "Alice" });

    expect(useAnswersStore.getState().answers.realName).toBe("Alice");
    expect(useAnswersStore.getState().answers.callMe).toBe("Babe");
    expect(usePersonaStore.getState().persona.callMe).toBe("Babe");
  });

  it("Feeling → records the goal as the only chip", () => {
    useAnswersStore.getState().setAnswer("feeling", "Calm me down");
    useAnswersStore.getState().setAnswer("chips", ["Calm me down"]);

    expect(useAnswersStore.getState().answers.feeling).toBe("Calm me down");
    expect(useAnswersStore.getState().answers.chips).toEqual(["Calm me down"]);
  });

  it("Source → adds chip, addTheme (skipping 'No idea'), and the phrase composes", () => {
    useAnswersStore.getState().setAnswer("feeling", "Calm me down");
    useAnswersStore.getState().setAnswer("source", "Work");
    useAnswersStore.getState().setAnswer("chips", ["Calm me down", "Work"]);
    usePersonaStore.getState().addTheme("Work");

    expect(usePersonaStore.getState().persona.themes).toBe("Work");
    expect(
      buildWeCanPhrase(
        useAnswersStore.getState().answers.feeling ?? "",
        useAnswersStore.getState().answers.source ?? "",
      ),
    ).toBe("calm your stress around work");
  });

  it("Promise → reminder time and wantsProgram persist", () => {
    useAnswersStore.getState().setAnswer("reminderTime", "20:00");
    useAnswersStore.getState().setAnswer("wantsProgram", true);

    expect(useAnswersStore.getState().answers.reminderTime).toBe("20:00");
    expect(useAnswersStore.getState().answers.wantsProgram).toBe(true);
  });
});
