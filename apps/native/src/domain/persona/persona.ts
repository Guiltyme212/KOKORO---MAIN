export type Persona = {
  callMe: string;
  realName?: string;
  themes: string; // comma-separated, newest first, cap 20, case-insensitive dedupe
  meditations: string; // semicolon-separated "vibe (feeling)" entries, newest first, cap 3
};

export const PERSONA_DEFAULT: Persona = {
  callMe: "",
  themes: "",
  meditations: "",
};

export const THEMES_CAP = 20;
export const MEDITATIONS_CAP = 3;

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

export function recordMeditation(
  persona: Persona,
  input: { vibe: string; feeling?: string },
): Persona {
  const entry = input.feeling ? `${input.vibe} (${input.feeling})` : input.vibe;
  const existing = persona.meditations
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const next = [entry, ...existing].slice(0, MEDITATIONS_CAP);
  return { ...persona, meditations: next.join("; ") };
}

export function countPersonaThemes(themes: string): number {
  return themes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
}
