export type Persona = {
  callMe: string;
  realName?: string;
  themes: string; // comma-separated, newest first, cap 20, case-insensitive dedupe
  meditations: string; // semicolon-separated "vibe (feeling)" entries, newest first, cap 3
  // ISO yyyy-mm-dd of the last day the user finished a meditation (the
  // streak engine bumps this on recordMeditation). Optional — absent means
  // no session has ever been recorded.
  lastSessionDate?: string;
  // Consecutive-day streak ending at `lastSessionDate`. 0 ⇔ no streak.
  streakDays?: number;
  // Comma-separated yyyy-mm-dd dates of the most recent 28 session days.
  // Powers the 7-day bar chart on Progress.
  sessionDates?: string;
};

export const PERSONA_DEFAULT: Persona = {
  callMe: "",
  themes: "",
  meditations: "",
};

export const THEMES_CAP = 20;
export const MEDITATIONS_CAP = 3;
export const SESSION_DATES_CAP = 28;

// Pure: returns a new Persona; never mutates the input.
export function addTheme(persona: Persona, rawLabel: string): Persona {
  const label = rawLabel.trim();
  if (!label) return persona;
  const existing = persona.themes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lowered = label.toLowerCase();
  const deduped = existing.filter((t) => t.toLowerCase() !== lowered);
  const next = [label, ...deduped].slice(0, THEMES_CAP);
  return { ...persona, themes: next.join(", ") };
}

// Format a Date as yyyy-mm-dd in the local timezone. Pure helper so we don't
// pull date-fns into the domain.
const toLocalIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ad0 = Date.UTC(ay, am - 1, ad);
  const bd0 = Date.UTC(by, bm - 1, bd);
  return Math.round((bd0 - ad0) / 86400000);
};

export function recordMeditation(
  persona: Persona,
  input: { vibe: string; feeling?: string; now?: Date },
): Persona {
  const entry = input.feeling ? `${input.vibe} (${input.feeling})` : input.vibe;
  const existing = persona.meditations
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const next = [entry, ...existing].slice(0, MEDITATIONS_CAP);

  const today = toLocalIsoDate(input.now ?? new Date());
  const prevDate = persona.lastSessionDate;
  let streakDays = persona.streakDays ?? 0;
  if (prevDate === today) {
    // Same day — streak unchanged.
  } else if (prevDate && daysBetween(prevDate, today) === 1) {
    streakDays += 1;
  } else {
    streakDays = 1;
  }

  const datesArr = (persona.sessionDates ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (datesArr[0] !== today) datesArr.unshift(today);
  const sessionDates = datesArr.slice(0, SESSION_DATES_CAP).join(",");

  return {
    ...persona,
    meditations: next.join("; "),
    lastSessionDate: today,
    streakDays,
    sessionDates,
  };
}

export function countPersonaThemes(themes: string): number {
  return themes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
}

// Helpers exposed for the Progress UI + tests.
export const isoToday = (now: Date = new Date()): string => toLocalIsoDate(now);
export const daysApart = daysBetween;
