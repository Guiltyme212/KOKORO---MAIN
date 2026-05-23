import { LegalScreen, type LegalBlock } from "@presentation/components/LegalScreen";

// Source: apps/web/public/privacy.html (last updated 2026-05-19). Keep these
// two files in sync — the public web page is the canonical text for App
// Store privacy links.

const BLOCKS: LegalBlock[] = [
  { kind: "h1", text: "Privacy Policy" },
  { kind: "meta", text: "Kokoro · Last updated 2026-05-19" },
  {
    kind: "p",
    text: "Kokoro is a voice-first meditation app. We collect the minimum needed to generate a personalized meditation for you and to improve the product. This policy describes what we collect, why, and how to remove it.",
  },

  { kind: "h2", text: "What we collect" },
  {
    kind: "ul",
    items: [
      "What you tell Kokoro. Your chosen name, the feeling or situation you describe, and any text or voice you give us in chat. Voice input is converted to text for meditation generation.",
      "Generated meditations. The scripts and audio Kokoro creates for you, stored so you can replay them.",
      "Device and session identifiers. A non-personal device identifier so saved meditations stay associated with you across app launches.",
      "Diagnostic data. Error logs and latency timings, used only to fix bugs.",
    ],
  },

  { kind: "h2", text: "What we do not collect" },
  {
    kind: "ul",
    items: [
      "We do not sell your data.",
      "We do not use your voice or text inputs to train AI models.",
      "We do not track you across other apps or websites.",
      "We do not collect precise location, contacts, photos, or health data.",
    ],
  },

  { kind: "h2", text: "Service providers we use" },
  {
    kind: "p",
    text: "To generate the meditation we send your inputs to the following processors. They process your data only on Kokoro's behalf and are not permitted to use it for their own purposes.",
  },
  {
    kind: "ul",
    items: [
      "OpenAI / Anthropic — generates the meditation script from your inputs.",
      "Suno — generates the meditation audio from the script.",
      "ElevenLabs — powers the voice conversation in chat.",
      "Railway / Vercel Blob — hosts the backend and stores generated audio.",
    ],
  },

  { kind: "h2", text: "How long we keep your data" },
  {
    kind: "p",
    text: "Generated meditations and chat inputs are retained for as long as your device identifier is active. Diagnostic logs are rotated after 30 days.",
  },

  { kind: "h2", text: "Deleting your data" },
  {
    kind: "p",
    text: "Open Settings → Delete account to remove your saved meditations and identifiers. Or email hyperspacelapse@gmail.com with the words \"delete my Kokoro data\" and we will remove your data within 30 days.",
  },

  { kind: "h2", text: "Children" },
  {
    kind: "p",
    text: "Kokoro is not directed to children under 13 and we do not knowingly collect data from them.",
  },

  { kind: "h2", text: "Not medical advice" },
  {
    kind: "p",
    text: "Kokoro is for relaxation and self-reflection. It is not a substitute for professional mental health care, and the AI is not a therapist. If you are in crisis, please contact local emergency services or a qualified professional.",
  },

  { kind: "h2", text: "Changes" },
  {
    kind: "p",
    text: "If this policy changes we will update the \"Last updated\" date above and, for material changes, surface a notice inside the app.",
  },

  { kind: "h2", text: "Contact" },
  { kind: "p", text: "Questions: hyperspacelapse@gmail.com." },
];

export default function PrivacyScreen() {
  return <LegalScreen blocks={BLOCKS} />;
}
