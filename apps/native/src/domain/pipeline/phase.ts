import type { Vibe } from "@domain/meditation/vibe";
import { ALL_VIBES } from "@domain/meditation/vibe";

export type PipelinePhase = "idle" | "starting" | "script" | "streaming" | "ready" | "error";

export type VibeProgress = {
  phase: PipelinePhase;
  error: string | null;
  startedAt: number | null;
};

export const idleVibeProgress = (): VibeProgress => ({
  phase: "idle",
  error: null,
  startedAt: null,
});

export type ProgressState = Record<Vibe, VibeProgress>;

export const blankProgressState = (): ProgressState =>
  ALL_VIBES.reduce<ProgressState>((acc, v) => {
    acc[v] = idleVibeProgress();
    return acc;
  }, {} as ProgressState);
