import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { GenerateMeditationOutput } from "@domain/meditation/generate-meditation";
import type { Vibe } from "@domain/meditation/vibe";
import { asyncStorageJsonStorage } from "./persistence";

type GeneratedByVibe = Partial<Record<Vibe, GenerateMeditationOutput>>;

type GeneratedStore = {
  current: GenerateMeditationOutput | null;
  byVibe: GeneratedByVibe;
  set(value: GenerateMeditationOutput | null): void;
  update(partial: Partial<GenerateMeditationOutput>): void;
  setForVibe(vibe: Vibe, value: GenerateMeditationOutput): void;
  updateForVibe(vibe: Vibe, partial: Partial<GenerateMeditationOutput>): void;
  selectVibeAsCurrent(vibe: Vibe): void;
  reset(): void;
};

export const useGeneratedMeditationStore = create<GeneratedStore>()(
  persist(
    (set, get) => ({
      current: null,
      byVibe: {},
      set: (value) => set({ current: value }),
      update: (partial) => {
        const cur = get().current;
        if (!cur) return;
        set({ current: { ...cur, ...partial } });
      },
      setForVibe: (vibe, value) => set((s) => ({ byVibe: { ...s.byVibe, [vibe]: value } })),
      updateForVibe: (vibe, partial) => {
        const existing = get().byVibe[vibe];
        if (!existing) return;
        set((s) => ({ byVibe: { ...s.byVibe, [vibe]: { ...existing, ...partial } } }));
      },
      selectVibeAsCurrent: (vibe) => {
        const record = get().byVibe[vibe];
        if (record) set({ current: record });
      },
      reset: () => set({ current: null, byVibe: {} }),
    }),
    { name: "kokoro_generated_meditation_store", storage: asyncStorageJsonStorage },
  ),
);
