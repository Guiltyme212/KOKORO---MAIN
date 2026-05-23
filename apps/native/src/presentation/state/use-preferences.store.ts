import { create } from "zustand";
import { persist } from "zustand/middleware";

import { setLocale, type Locale } from "@presentation/i18n";
import { asyncStorageJsonStorage } from "./persistence";

export type AppearanceMode = "auto" | "light" | "dark";

type PreferencesStore = {
  locale: Locale;
  appearance: AppearanceMode;
  setLocale(locale: Locale): void;
  setAppearance(mode: AppearanceMode): void;
};

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      locale: "en",
      appearance: "auto",
      setLocale: (locale) => {
        setLocale(locale);
        set({ locale });
      },
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      name: "kokoro_preferences",
      storage: asyncStorageJsonStorage,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setLocale(state.locale);
      },
    },
  ),
);
