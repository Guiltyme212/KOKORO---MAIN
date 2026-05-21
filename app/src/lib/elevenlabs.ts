import { API_BASE } from './config';

export async function getConversationToken(participantName?: string): Promise<string> {
  const url = new URL(`${API_BASE}/elevenlabs/conversation-token`);
  if (participantName?.trim()) url.searchParams.set('participantName', participantName.trim());

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `elevenlabs token ${res.status}`);
  }

  const body = await res.json() as { token?: unknown };
  if (typeof body.token !== 'string' || !body.token) {
    throw new Error('elevenlabs token missing');
  }
  return body.token;
}

export async function getConversationSignedUrl(): Promise<string> {
  const url = `${API_BASE}/elevenlabs/conversation-signed-url`;

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `elevenlabs signed-url ${res.status}`);
  }

  const body = await res.json() as { signedUrl?: unknown };
  if (typeof body.signedUrl !== 'string' || !body.signedUrl) {
    throw new Error('elevenlabs signedUrl missing');
  }
  return body.signedUrl;
}
