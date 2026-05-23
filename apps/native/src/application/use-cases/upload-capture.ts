import type { CaptureBlob, UploadsPort } from "@application/ports/uploads.port";
import type { Capture } from "@domain/meditation/capture";

export type UploadCaptureDeps = { uploads: UploadsPort };

export const uploadCapture =
  ({ uploads }: UploadCaptureDeps) =>
  async (blob: CaptureBlob, transcribedText?: string): Promise<Capture> => {
    const out = await uploads.uploadCapture(blob);
    return {
      kind: "voice",
      audioUrl: out.audioUrl,
      mimeType: out.mimeType,
      transcribedText,
    };
  };
