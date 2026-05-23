import { ALL_VIBES, isVibe } from "./vibe";

describe("Vibe", () => {
  it("exposes exactly 5 vibes", () => {
    expect(ALL_VIBES).toHaveLength(5);
    expect([...ALL_VIBES].sort()).toEqual(["cosmic", "iron", "raw", "sleep", "zen"]);
  });

  it("isVibe accepts valid strings", () => {
    expect(isVibe("zen")).toBe(true);
    expect(isVibe("raw")).toBe(true);
  });

  it("isVibe rejects everything else", () => {
    expect(isVibe("")).toBe(false);
    expect(isVibe("happy")).toBe(false);
    expect(isVibe(null)).toBe(false);
    expect(isVibe(undefined)).toBe(false);
    expect(isVibe(42)).toBe(false);
  });
});
