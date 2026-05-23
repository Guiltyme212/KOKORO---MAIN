import type { Answers } from "@domain/answers/answers";
import type { LibraryItem } from "@domain/library/library-item";
import type { GenerateMeditationOutput } from "@domain/meditation/generate-meditation";
import type { LibraryPort } from "@application/ports/library.port";

export type SaveToLibraryDeps = { library: LibraryPort };

export class LibraryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LibraryError";
  }
}

export const buildLibraryItem = (
  generated: GenerateMeditationOutput,
  answers: Answers,
  capturePreview?: string,
): LibraryItem => {
  const audioUrl = generated.audioUrl || generated.streamAudioUrl || "";
  if (!audioUrl) {
    throw new LibraryError("AUDIO_NOT_READY", "Final audio is still preparing.");
  }
  const now = new Date().toISOString();
  return {
    meditationId: generated.meditationId,
    audioUrl,
    durationSec: generated.durationSec,
    callMe: answers.callMe || answers.realName || "friend",
    realName: answers.realName,
    vibe: generated.vibe,
    capturePreview,
    savedAt: now,
    generatedAt: generated.generatedAt || now,
  };
};

export const saveToLibrary =
  ({ library }: SaveToLibraryDeps) =>
  async (item: LibraryItem): Promise<LibraryItem[]> =>
    library.save(item);
