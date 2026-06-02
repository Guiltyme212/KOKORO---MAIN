import { tgUser } from './telegram';
import { API_BASE } from './config';

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
