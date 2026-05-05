import type {
  GenerateMeditationInput,
  GenerateMeditationOutput,
  StreamEvent,
} from './types-meditation';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787';

export async function generateMeditation(
  input: GenerateMeditationInput,
  signal?: AbortSignal,
): Promise<GenerateMeditationOutput> {
  const res = await fetch(`${API_BASE}/meditations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `api ${res.status}: ${body.error ?? 'unknown'} ${JSON.stringify(body.details ?? {})}`,
    );
  }

  return res.json();
}

// Posts to /meditations/stream and yields each NDJSON line as a typed event.
// Throws on `event: 'error'` (caller gets a normal Promise rejection in the
// for-await loop). The stream stays open until the server closes it after
// emitting `ready`.
export async function* generateMeditationStreaming(
  input: GenerateMeditationInput,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  const res = await fetch(`${API_BASE}/meditations/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `api ${res.status}: ${body.error ?? 'unknown'} ${JSON.stringify(body.details ?? {})}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });

      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) {
          const parsed = JSON.parse(line) as StreamEvent;
          if (parsed.event === 'error') {
            throw new Error(
              `stream ${parsed.error}: ${JSON.stringify(parsed.details ?? {})}`,
            );
          }
          yield parsed;
        }
        nl = buffer.indexOf('\n');
      }

      if (done) {
        const tail = buffer.trim();
        if (tail) {
          const parsed = JSON.parse(tail) as StreamEvent;
          if (parsed.event === 'error') {
            throw new Error(
              `stream ${parsed.error}: ${JSON.stringify(parsed.details ?? {})}`,
            );
          }
          yield parsed;
        }
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
