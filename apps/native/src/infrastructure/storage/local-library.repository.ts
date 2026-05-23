import AsyncStorage from "@react-native-async-storage/async-storage";

import type { LibraryItem } from "@domain/library/library-item";
import { sortByNewest } from "@domain/library/library-item";

export const LOCAL_LIBRARY_KEY = "kokoro_local_library";

const safeParse = (raw: string | null): LibraryItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LibraryItem =>
        item &&
        typeof item === "object" &&
        typeof item.meditationId === "string" &&
        typeof item.audioUrl === "string" &&
        typeof item.vibe === "string",
    );
  } catch {
    return [];
  }
};

export const localLibraryRepository = {
  async list(): Promise<LibraryItem[]> {
    const raw = await AsyncStorage.getItem(LOCAL_LIBRARY_KEY);
    return sortByNewest(safeParse(raw));
  },

  async save(item: LibraryItem): Promise<LibraryItem[]> {
    const existing = await localLibraryRepository.list();
    const next = sortByNewest([
      item,
      ...existing.filter((row) => row.meditationId !== item.meditationId),
    ]);
    await AsyncStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(next));
    return next;
  },

  async remove(meditationId: string): Promise<LibraryItem[]> {
    const existing = await localLibraryRepository.list();
    const next = existing.filter((row) => row.meditationId !== meditationId);
    await AsyncStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(next));
    return next;
  },

  async isSaved(meditationId: string): Promise<boolean> {
    const existing = await localLibraryRepository.list();
    return existing.some((row) => row.meditationId === meditationId);
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(LOCAL_LIBRARY_KEY);
  },
};
