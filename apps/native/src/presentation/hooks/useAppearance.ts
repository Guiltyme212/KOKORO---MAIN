import { useColorScheme } from "react-native";

import { usePreferencesStore } from "@presentation/state/use-preferences.store";

// Returns the effective color scheme honoring the user's per-app override.
// "auto" follows the OS; explicit values win over it.
export function useAppearance(): "light" | "dark" {
  const system = useColorScheme();
  const mode = usePreferencesStore((s) => s.appearance);
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return system === "dark" ? "dark" : "light";
}
