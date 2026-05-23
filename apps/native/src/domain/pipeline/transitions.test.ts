import { canTransition, rehydratePhase } from "./transitions";

describe("rehydratePhase", () => {
  it("demotes in-flight phases to error", () => {
    for (const phase of ["starting", "script", "streaming"] as const) {
      const next = rehydratePhase({ phase, error: null, startedAt: 1 });
      expect(next.phase).toBe("error");
      expect(next.error).toBe("interrupted");
    }
  });

  it("preserves terminal phases", () => {
    const idle = { phase: "idle" as const, error: null, startedAt: null };
    expect(rehydratePhase(idle)).toBe(idle);
    const ready = { phase: "ready" as const, error: null, startedAt: 1 };
    expect(rehydratePhase(ready)).toBe(ready);
    const error = { phase: "error" as const, error: "boom", startedAt: 1 };
    expect(rehydratePhase(error)).toBe(error);
  });
});

describe("canTransition", () => {
  it("allows the happy path", () => {
    expect(canTransition("idle", "starting")).toBe(true);
    expect(canTransition("starting", "script")).toBe(true);
    expect(canTransition("script", "streaming")).toBe(true);
    expect(canTransition("streaming", "ready")).toBe(true);
  });

  it("allows retry/error fan-out", () => {
    expect(canTransition("starting", "error")).toBe(true);
    expect(canTransition("error", "starting")).toBe(true);
    expect(canTransition("ready", "starting")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("idle", "ready")).toBe(false);
    expect(canTransition("script", "ready")).toBe(false);
    expect(canTransition("ready", "streaming")).toBe(false);
  });
});
