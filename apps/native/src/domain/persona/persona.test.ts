import fc from "fast-check";
import {
  addTheme,
  countPersonaThemes,
  MEDITATIONS_CAP,
  PERSONA_DEFAULT,
  recordMeditation,
  THEMES_CAP,
} from "./persona";

describe("addTheme", () => {
  it("prepends a new theme", () => {
    const next = addTheme(PERSONA_DEFAULT, "work");
    expect(next.themes).toBe("work");
  });

  it("ignores empty/whitespace labels", () => {
    expect(addTheme(PERSONA_DEFAULT, "")).toEqual(PERSONA_DEFAULT);
    expect(addTheme(PERSONA_DEFAULT, "   ")).toEqual(PERSONA_DEFAULT);
  });

  it("dedupes case-insensitively, preserving the new label's casing", () => {
    const after = addTheme({ ...PERSONA_DEFAULT, themes: "Work, sleep" }, "WORK");
    expect(after.themes).toBe("WORK, sleep");
  });

  it("caps at THEMES_CAP", () => {
    let p = PERSONA_DEFAULT;
    for (let i = 0; i < THEMES_CAP + 5; i += 1) p = addTheme(p, `t${i}`);
    expect(countPersonaThemes(p.themes)).toBe(THEMES_CAP);
  });

  it("never exceeds the cap for any sequence of inputs", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 50 }), (labels) => {
        const p = labels.reduce((acc, label) => addTheme(acc, label), PERSONA_DEFAULT);
        expect(countPersonaThemes(p.themes)).toBeLessThanOrEqual(THEMES_CAP);
      }),
    );
  });
});

describe("recordMeditation", () => {
  it("prepends and caps at MEDITATIONS_CAP", () => {
    let p = PERSONA_DEFAULT;
    p = recordMeditation(p, { vibe: "zen", feeling: "Calm me down" });
    p = recordMeditation(p, { vibe: "raw", feeling: "Give me confidence" });
    p = recordMeditation(p, { vibe: "iron" });
    p = recordMeditation(p, { vibe: "sleep" });
    const entries = p.meditations.split(";").map((s) => s.trim());
    expect(entries).toHaveLength(MEDITATIONS_CAP);
    expect(entries[0]).toBe("sleep");
  });

  it("formats as 'vibe (feeling)' when feeling provided", () => {
    const p = recordMeditation(PERSONA_DEFAULT, { vibe: "zen", feeling: "Help me sleep" });
    expect(p.meditations).toBe("zen (Help me sleep)");
  });

  it("starts a streak at 1 on the first session", () => {
    const p = recordMeditation(PERSONA_DEFAULT, {
      vibe: "zen",
      now: new Date("2026-05-23T12:00:00"),
    });
    expect(p.streakDays).toBe(1);
    expect(p.lastSessionDate).toBe("2026-05-23");
    expect(p.sessionDates).toBe("2026-05-23");
  });

  it("increments the streak on consecutive days", () => {
    let p = recordMeditation(PERSONA_DEFAULT, {
      vibe: "zen",
      now: new Date("2026-05-23T12:00:00"),
    });
    p = recordMeditation(p, { vibe: "raw", now: new Date("2026-05-24T12:00:00") });
    p = recordMeditation(p, { vibe: "iron", now: new Date("2026-05-25T12:00:00") });
    expect(p.streakDays).toBe(3);
    expect(p.lastSessionDate).toBe("2026-05-25");
  });

  it("does not bump the streak when the same day records twice", () => {
    let p = recordMeditation(PERSONA_DEFAULT, {
      vibe: "zen",
      now: new Date("2026-05-23T08:00:00"),
    });
    p = recordMeditation(p, { vibe: "raw", now: new Date("2026-05-23T20:00:00") });
    expect(p.streakDays).toBe(1);
    // sessionDates dedupes same-day entries
    expect(p.sessionDates).toBe("2026-05-23");
  });

  it("resets the streak when a day is skipped", () => {
    let p = recordMeditation(PERSONA_DEFAULT, {
      vibe: "zen",
      now: new Date("2026-05-20T12:00:00"),
    });
    p = recordMeditation(p, { vibe: "raw", now: new Date("2026-05-23T12:00:00") });
    expect(p.streakDays).toBe(1);
  });
});
