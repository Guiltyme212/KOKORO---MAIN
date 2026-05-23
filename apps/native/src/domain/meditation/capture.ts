export type VoiceCapture = {
  kind: "voice";
  audioUrl: string;
  mimeType: string;
  transcribedText?: string;
};

export type TextCapture = { kind: "text"; text: string };

export type ThemeCapture = { kind: "theme"; chips: string[] };

export type Capture = VoiceCapture | TextCapture | ThemeCapture;

export type CaptureValidation = { ok: true } | { ok: false; reason: string };

export const validateCapture = (capture: Capture): CaptureValidation => {
  switch (capture.kind) {
    case "text": {
      const len = capture.text.length;
      if (len < 1) return { ok: false, reason: "text capture cannot be empty" };
      if (len > 2000) return { ok: false, reason: "text capture exceeds 2000 chars" };
      return { ok: true };
    }
    case "theme": {
      const n = capture.chips.length;
      if (n < 1) return { ok: false, reason: "theme capture must include at least one chip" };
      if (n > 6) return { ok: false, reason: "theme capture limited to 6 chips" };
      return { ok: true };
    }
    case "voice": {
      if (!capture.audioUrl) return { ok: false, reason: "voice capture missing audioUrl" };
      if (!capture.mimeType) return { ok: false, reason: "voice capture missing mimeType" };
      return { ok: true };
    }
  }
};
