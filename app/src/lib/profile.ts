import type { Answers, Persona } from '../types';

export function cleanText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function countPersonaThemes(themes: string): number {
  return themes
    .split(',')
    .map((theme) => theme.trim())
    .filter(Boolean).length;
}

// True when there is enough persisted profile to treat this as a returning user
// (used both for post-Apple-sign-in routing and launch-route restoration).
export function hasCompletedLocalProfile(answers: Answers, persona: Persona): boolean {
  const answersName = cleanText(answers.callMe || answers.realName);
  const personaName = cleanText(persona.callMe || persona.realName);
  const answersProfileComplete = Boolean(
    answersName &&
    cleanText(answers.feeling) &&
    cleanText(answers.source),
  );
  const personaProfileComplete = Boolean(
    personaName &&
    (countPersonaThemes(persona.themes) >= 2 || cleanText(persona.meditations)),
  );

  return answersProfileComplete || personaProfileComplete;
}
