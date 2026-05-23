import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";

import { en } from "./en";
import { ru } from "./ru";

export type Locale = "en" | "ru";

const SUPPORTED: readonly Locale[] = ["en", "ru"] as const;

const detectLocale = (): Locale => {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase() ?? "en";
    return (SUPPORTED as readonly string[]).includes(code) ? (code as Locale) : "en";
  } catch {
    return "en";
  }
};

export const i18n = new I18n({ en, ru });
i18n.defaultLocale = "en";
i18n.enableFallback = true;
i18n.locale = detectLocale();

export const setLocale = (locale: Locale): void => {
  i18n.locale = locale;
};

// Tiny helper so call sites use `t("welcome.cta")` instead of i18n.t(...).
export const t = (
  key: string,
  options?: Record<string, string | number>,
): string => i18n.t(key, options);
