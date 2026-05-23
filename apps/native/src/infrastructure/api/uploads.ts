import type {
  CaptureBlob,
  UploadResponse,
  UploadsPort,
} from "@application/ports/uploads.port";
import { API_BASE } from "@infrastructure/http/client";

const extFor = (mime: string): string => {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "m4a";
};

export const uploadsApi: UploadsPort = {
  async uploadCapture(blob: CaptureBlob): Promise<UploadResponse> {
    const form = new FormData();
    form.append("file", {
      // RN's FormData accepts {uri, name, type} objects for file uploads.
      uri: blob.uri,
      name: `capture.${extFor(blob.mimeType)}`,
      type: blob.mimeType,
    } as unknown as Blob);
    const res = await fetch(`${API_BASE}/uploads`, { method: "POST", body: form });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`upload failed (${res.status}): ${detail}`);
    }
    return (await res.json()) as UploadResponse;
  },
};
