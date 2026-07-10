import { tgUser } from './telegram';
import { apiFetch } from './apiTransport';
import { isProtectedWebClient } from './platform';

export async function sendFeedback(meditationId: string, liked: boolean): Promise<void> {
  const tgUserId = tgUser()?.id;
  const res = await apiFetch(
    `/meditations/${encodeURIComponent(meditationId)}/feedback`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(isProtectedWebClient() ? { liked } : { liked, tgUserId }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`feedback failed (${res.status}): ${detail}`);
  }
}
