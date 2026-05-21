export const API_BASE = (
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ||
  'http://127.0.0.1:8787'
).replace(/\/+$/, '');

export const ELEVENLABS_AGENT_ID = (
  (import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined)?.trim() ||
  'agent_3101krqbh19mezt9t835q2f7s5ds'
);

export function friendlyApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (
    message.includes('Failed to fetch') ||
    message.includes('Load failed') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed')
  ) {
    return `Could not reach Kokoro's server at ${API_BASE}.`;
  }
  return message || 'Something went wrong.';
}
