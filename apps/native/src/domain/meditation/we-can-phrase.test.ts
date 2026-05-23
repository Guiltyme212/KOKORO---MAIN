import { buildWeCanPhrase, GOAL_CLAUSE, MAIN_GOALS, SOURCE_TAIL, SOURCES } from "./we-can-phrase";

describe("buildWeCanPhrase", () => {
  it("covers every main goal × source pair without throwing", () => {
    for (const goal of MAIN_GOALS) {
      for (const source of SOURCES) {
        const phrase = buildWeCanPhrase(goal, source);
        expect(phrase.length).toBeGreaterThan(0);
      }
    }
  });

  it("emits the canonical phrase for Calm me down + Work", () => {
    expect(buildWeCanPhrase("Calm me down", "Work")).toBe("calm your stress around work");
  });

  it("falls back to the generic clause for unknown goals", () => {
    expect(buildWeCanPhrase("anything", "Work")).toBe("sit with whatever this is around work");
  });

  it("returns empty tail for No idea", () => {
    expect(buildWeCanPhrase("Help me sleep", "No idea")).toBe("settle the restlessness");
  });

  it("GOAL_CLAUSE covers every MAIN_GOAL", () => {
    for (const goal of MAIN_GOALS) expect(GOAL_CLAUSE[goal]).toBeDefined();
  });

  it("SOURCE_TAIL covers every SOURCE", () => {
    for (const source of SOURCES) expect(SOURCE_TAIL[source]).toBeDefined();
  });
});
