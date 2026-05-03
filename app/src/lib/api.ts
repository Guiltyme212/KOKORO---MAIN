import type { GenerateMeditationInput, GenerateMeditationOutput } from './types-meditation';

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
