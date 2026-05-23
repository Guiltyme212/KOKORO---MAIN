import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Vibe } from "@domain/meditation/vibe";
import { blankProgressState, type ProgressState, type VibeProgress } from "@domain/pipeline/phase";
import { rehydratePhase } from "@domain/pipeline/transitions";
import { asyncStorageJsonStorage } from "./persistence";

type ProgressStore = {
  progress: ProgressState;
  setVibe(vibe: Vibe, partial: Partial<VibeProgress>): void;
  reset(): void;
};

export const useMeditationProgressStore = create<ProgressStore>()(
  persist(
    (set) => ({
      progress: blankProgressState(),
      setVibe: (vibe, partial) =>
        set((s) => ({
          progress: {
            ...s.progress,
            [vibe]: { ...s.progress[vibe], ...partial },
          },
        })),
      reset: () => set({ progress: blankProgressState() }),
    }),
    {
      name: "kokoro_meditation_progress",
      storage: asyncStorageJsonStorage,
      // On rehydrate, demote any in-flight phases to error — the stream is
      // dead by the time the app reloads, so the UI shouldn't sit spinning.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const next: ProgressState = { ...state.progress };
        for (const vibe of Object.keys(next) as Vibe[]) {
          next[vibe] = rehydratePhase(next[vibe]);
        }
        state.progress = next;
      },
    },
  ),
);
