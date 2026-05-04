import type { UploadResponse } from './types-meditation';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787';

export async function uploadCapture(blob: Blob): Promise<UploadResponse> {
  const form = new FormData();
  // The backend cares about the mime type (audio/webm vs audio/mp4 etc.) more
  // than the filename, but FormData requires a name and one — supply both.
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('file', blob, `capture.${ext}`);

  const res = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`upload failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<UploadResponse>;
}
