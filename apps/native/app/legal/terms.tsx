import { LegalScreen, type LegalBlock } from "@presentation/components/LegalScreen";

const BLOCKS: LegalBlock[] = [
  { kind: "h1", text: "Terms of Use" },
  { kind: "meta", text: "Kokoro · Last updated 2026-05-23" },

  {
    kind: "p",
    text: "These terms describe how you may use Kokoro. By installing or using the app, you agree to them.",
  },

  { kind: "h2", text: "What Kokoro is" },
  {
    kind: "p",
    text: "Kokoro is a voice-first AI meditation app. It generates short personalized meditations based on what you tell it.",
  },

  { kind: "h2", text: "What it is not" },
  {
    kind: "p",
    text: "Kokoro is not a therapist, doctor, or emergency service. It is not a substitute for professional mental-health, medical, or crisis care. If you are in crisis, contact local emergency services or a qualified professional.",
  },

  { kind: "h2", text: "Acceptable use" },
  {
    kind: "ul",
    items: [
      "Use Kokoro only for personal, non-commercial purposes.",
      "Do not abuse, harass, or attempt to harm other users or the service.",
      "Do not attempt to extract model weights, reverse-engineer the app, or scrape generated content at scale.",
      "Do not share generated audio in a way that misrepresents it as the work of another artist or person.",
    ],
  },

  { kind: "h2", text: "Your content" },
  {
    kind: "p",
    text: "You own what you tell Kokoro. You grant us a limited license to process those inputs solely to generate, store, and replay your meditations. See the Privacy Policy for details.",
  },

  { kind: "h2", text: "Our content" },
  {
    kind: "p",
    text: "The Kokoro brand, mascot art, app code, and templates are owned by Kokoro and protected by copyright. You may use them only as part of the normal operation of the app.",
  },

  { kind: "h2", text: "Termination" },
  {
    kind: "p",
    text: "You may delete your account at any time from Settings. We may suspend access if you breach these terms or use the service in a way that risks others or our infrastructure.",
  },

  { kind: "h2", text: "Disclaimer" },
  {
    kind: "p",
    text: "Kokoro is provided \"as is\" without warranty of any kind. We do our best to keep it running, but generated content varies and occasional service interruptions or quality issues are expected.",
  },

  { kind: "h2", text: "Changes" },
  {
    kind: "p",
    text: "We may update these terms; the \"Last updated\" date will reflect the change. Material changes will be surfaced in the app.",
  },

  { kind: "h2", text: "Contact" },
  { kind: "p", text: "Questions or notices: hyperspacelapse@gmail.com." },
];

export default function TermsScreen() {
  return <LegalScreen blocks={BLOCKS} />;
}
