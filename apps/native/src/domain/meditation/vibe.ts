export type Vibe = "raw" | "cosmic" | "iron" | "zen" | "sleep";

export const ALL_VIBES: readonly Vibe[] = ["raw", "cosmic", "iron", "sleep", "zen"] as const;

export const isVibe = (value: unknown): value is Vibe =>
  typeof value === "string" && (ALL_VIBES as readonly string[]).includes(value);
