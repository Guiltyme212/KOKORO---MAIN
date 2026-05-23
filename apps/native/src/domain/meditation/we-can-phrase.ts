// Source: apps/web/src/screens/Kokoro3.tsx — verbatim copy. These two maps and
// the join function are the single phrasing rule the ElevenLabs agent receives
// via the `we_can_phrase` dynamic variable.

export const GOAL_CLAUSE: Record<string, string> = {
  "Calm me down": "calm your stress",
  "Help me sleep": "settle the restlessness",
  "Give me confidence": "work on your self-doubt",
  "Let me talk it out": "talk through what's been heavy",
  "Show me my future self": "look at who you're becoming",
  "I don't know": "sit with whatever's weighing on you",
};

export const SOURCE_TAIL: Record<string, string> = {
  Work: " around work",
  "Someone close": " with someone close to you",
  "My head": ", up in your head",
  "My body": ", what your body is holding",
  Money: " around money",
  "The future": " about the future",
  Family: " with family in the picture",
  "No idea": "",
};

export const MAIN_GOALS = [
  "Calm me down",
  "Help me sleep",
  "Give me confidence",
  "Let me talk it out",
  "Show me my future self",
  "I don't know",
] as const;

export const SOURCES = [
  "Work",
  "Someone close",
  "My head",
  "My body",
  "Money",
  "The future",
  "Family",
  "No idea",
] as const;

export function buildWeCanPhrase(mainGoal: string, source: string): string {
  const clause = GOAL_CLAUSE[mainGoal] ?? "sit with whatever this is";
  const tail = SOURCE_TAIL[source] ?? "";
  return `${clause}${tail}`;
}
