import AsyncStorage from "@react-native-async-storage/async-storage";

import type { GenerateMeditationOutput } from "@domain/meditation/generate-meditation";
import type { Vibe } from "@domain/meditation/vibe";

export const GENERATED_CURRENT_KEY = "kokoro_generated_meditation";
export const GENERATED_BY_VIBE_KEY = "kokoro_generated_meditations_by_vibe";

export type GeneratedByVibe = Partial<Record<Vibe, GenerateMeditationOutput>>;

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const generatedMeditationRepository = {
  readCurrent: (): Promise<GenerateMeditationOutput | null> =>
    readJson<GenerateMeditationOutput | null>(GENERATED_CURRENT_KEY, null),

  writeCurrent: async (value: GenerateMeditationOutput | null): Promise<void> => {
    if (value === null) {
      await AsyncStorage.removeItem(GENERATED_CURRENT_KEY);
      return;
    }
    await AsyncStorage.setItem(GENERATED_CURRENT_KEY, JSON.stringify(value));
  },

  readByVibe: (): Promise<GeneratedByVibe> => readJson<GeneratedByVibe>(GENERATED_BY_VIBE_KEY, {}),

  writeByVibe: async (value: GeneratedByVibe): Promise<void> => {
    await AsyncStorage.setItem(GENERATED_BY_VIBE_KEY, JSON.stringify(value));
  },

  clear: async (): Promise<void> => {
    await AsyncStorage.removeItem(GENERATED_CURRENT_KEY);
    await AsyncStorage.removeItem(GENERATED_BY_VIBE_KEY);
  },
};
