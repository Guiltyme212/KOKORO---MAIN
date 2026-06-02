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
  if (message.startsWith('stream UPSTREAM_TIMEOUT') || message.startsWith('api 504')) {
    return "Kokoro's audio service is taking too long. Try again in a moment.";
  }
  if (message.startsWith('stream UPSTREAM_RATE_LIMIT') || message.startsWith('api 429')) {
    return "Kokoro's audio service is busy. Give it about 30 seconds, then try again.";
  }
  if (message.startsWith('stream AUDIO_GEN_FAILED') || message.startsWith('api 422')) {
    return "Kokoro couldn't finish the audio for that one. Try again — it usually works on the next pass.";
  }
  if (message.startsWith('stream INTERNAL') || message.startsWith('api 500')) {
    return "Something hiccuped on Kokoro's side. Tap Try again — most of the time it works on the next attempt.";
  }
  return message || 'Something went wrong.';
}
