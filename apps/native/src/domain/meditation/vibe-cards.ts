import type { Vibe } from "./vibe";

export type VibeCard = {
  title: string;
  eyebrow: string;
  copy: string;
  accent: string;
  image: string;
  thumb: string;
  poster: string;
};

// Source: apps/web/src/screens/Kokoro3.tsx VIBE_CARDS (verbatim, including hex accents).
export const VIBE_CARDS: Record<Vibe, VibeCard> = {
  raw: {
    title: "Gen Z",
    eyebrow: "raw - unfiltered",
    copy: "No notes. Just real. Uses casual language and may swear.",
    accent: "#fc6708",
    image: "kokoro-proud.mp4",
    thumb: "thumb-kokoro-proud.m4v",
    poster: "kokoro-meditate.png",
  },
  cosmic: {
    title: "Spiritual",
    eyebrow: "cosmic - mystic",
    copy: "Soft, symbolic, a little lunar. Good for bigger feelings.",
    accent: "#8f8d3a",
    image: "kokoro-float.mp4",
    thumb: "thumb-kokoro-float.m4v",
    poster: "kokoro-float.png",
  },
  iron: {
    title: "Drive",
    eyebrow: "iron - direct",
    copy: "Grounded pressure release. Less soft, more backbone.",
    accent: "#d56e25",
    image: "kokoro-heart.mp4",
    thumb: "thumb-kokoro-heart.m4v",
    poster: "Kokoro-Standing-still.png",
  },
  sleep: {
    title: "Wind down",
    eyebrow: "bedtime - slow",
    copy: "Low and gentle for letting the day leave your body.",
    accent: "#71804b",
    image: "kokoro-meditate.mp4",
    thumb: "thumb-kokoro-meditate.m4v",
    poster: "kokoro-meditate.png",
  },
  zen: {
    title: "Zen",
    eyebrow: "still - clear",
    copy: "Clean, quiet, breath-led. The safest default.",
    accent: "#64764e",
    image: "kokoro-tea.mp4",
    thumb: "thumb-kokoro-tea.m4v",
    poster: "kokoro-meditate.png",
  },
};

export const SHORT_VIBE_COPY: Record<Vibe, string> = {
  raw: "Unfiltered, real talk",
  cosmic: "Soft and symbolic",
  iron: "Grounded pressure release",
  sleep: "Slow wind-down",
  zen: "Quiet breath-led calm",
};
