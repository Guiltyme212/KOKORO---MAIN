import type { Vibe } from "@domain/meditation/vibe";

export type LibraryItem = {
  meditationId: string;
  audioUrl: string;
  durationSec: number;
  callMe: string;
  realName?: string;
  vibe: Vibe;
  capturePreview?: string;
  savedAt: string; // ISO
  generatedAt: string; // ISO
};

export const sortByNewest = (items: LibraryItem[]): LibraryItem[] =>
  [...items].sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
