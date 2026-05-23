import type { Vibe } from "@domain/meditation/vibe";

export type Answers = {
  callMe: string;
  realName?: string;
  carry: string;
  chips: string[];
  vibe: Vibe | "";
  feeling?: string;
  source?: string;
  reminderTime?: string;
  // Identifier returned by expo-notifications when the daily reminder was
  // scheduled. Persisted so we can cancel/reschedule when the user changes
  // the time or signs out. Absent ⇒ no scheduled reminder.
  reminderIdentifier?: string;
  wantsProgram?: boolean;
};

export const ANSWERS_DEFAULT: Answers = {
  callMe: "",
  carry: "",
  chips: [],
  vibe: "",
};

export const SOFT_NAMES = [
  "Love",
  "Babe",
  "Honey",
  "Baby",
  "Sweetheart",
  "Sunshine",
  "Kitten",
] as const;
