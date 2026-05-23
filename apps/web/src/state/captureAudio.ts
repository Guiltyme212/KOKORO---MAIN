// In-memory hand-off of the recorded audio capture between Capture.tsx and
// Composing.tsx. Not persisted in localStorage because Blob isn't serializable
// and we don't want the recording to survive a refresh anyway.

let pending: Blob | null = null;

export const captureAudioApi = {
  set(blob: Blob | null): void {
    pending = blob;
  },
  /** Returns the pending blob and clears it. */
  take(): Blob | null {
    const out = pending;
    pending = null;
    return out;
  },
  peek(): Blob | null {
    return pending;
  },
};
