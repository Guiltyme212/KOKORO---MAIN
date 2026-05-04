import { tgUser } from './telegram';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787';

export async function sendFeedback(meditationId: string, liked: boolean): Promise<void> {
  const tgUserId = tgUser()?.id;
  const res = await fetch(
    `${API_BASE}/meditations/${encodeURIComponent(meditationId)}/feedback`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked, tgUserId }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`feedback failed (${res.status}): ${detail}`);
  }
}
