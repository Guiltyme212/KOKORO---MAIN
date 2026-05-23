import type { PipelinePhase, VibeProgress } from "./phase";

// Phases that depend on a live NDJSON stream — on app restart the fetch is
// dead, so demote them to `error` so the UI shows a retry instead of
// spinning forever. Terminal phases (`idle`, `ready`, `error`) survive.
const IN_FLIGHT: ReadonlySet<PipelinePhase> = new Set(["starting", "script", "streaming"]);

export const rehydratePhase = (slot: VibeProgress): VibeProgress =>
  IN_FLIGHT.has(slot.phase) ? { ...slot, phase: "error", error: "interrupted" } : slot;

// Legal transitions reachable through the streaming pipeline.
const TRANSITIONS: Record<PipelinePhase, readonly PipelinePhase[]> = {
  idle: ["starting"],
  starting: ["script", "error", "starting"], // re-entry allowed during transient retry
  script: ["streaming", "error"],
  streaming: ["ready", "error"],
  ready: ["idle", "starting"], // can be re-kicked off
  error: ["idle", "starting"], // retry from error
};

export const canTransition = (from: PipelinePhase, to: PipelinePhase): boolean =>
  TRANSITIONS[from].includes(to);
