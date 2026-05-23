// Source of truth for Kokoro 3 design tokens. Tailwind/uniwind config can
// reference these constants if needed, but the canonical Tailwind config
// file mirrors these directly.

export const palette = {
  ink: "#1b1b1b",
  muted: "#76715e",
  cream: "#f6ebd7",
  paper: "#fffaf0",
  stroke: "rgba(27,27,27,0.14)",
  moss: "#64764e",
  mossDark: "#4e6749",
  mossOlive: "#82863a",
  mustard: "#ecc34a",
  sunset: "#fc6708",
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const shadow = {
  k3: {
    shadowColor: "rgba(27,27,27,0.18)",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 14,
  },
} as const;
