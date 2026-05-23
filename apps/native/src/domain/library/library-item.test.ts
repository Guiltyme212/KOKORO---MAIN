import type { LibraryItem } from "./library-item";
import { sortByNewest } from "./library-item";

const item = (id: string, savedAt: string): LibraryItem => ({
  meditationId: id,
  audioUrl: "x",
  durationSec: 60,
  callMe: "friend",
  vibe: "zen",
  savedAt,
  generatedAt: savedAt,
});

describe("sortByNewest", () => {
  it("returns a new array (no mutation)", () => {
    const a = item("a", "2026-01-01T00:00:00Z");
    const input = [a];
    expect(sortByNewest(input)).not.toBe(input);
  });

  it("sorts newest first", () => {
    const a = item("a", "2026-01-01T00:00:00Z");
    const b = item("b", "2026-02-01T00:00:00Z");
    const c = item("c", "2026-03-01T00:00:00Z");
    expect(sortByNewest([a, b, c]).map((x) => x.meditationId)).toEqual(["c", "b", "a"]);
  });
});
