// 36-byte silent WAV: 1 frame, mono, 8-bit, 8000 Hz.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

// iOS WKWebView won't route WebRTC audio out until AVAudioSession is activated
// by a user gesture. ElevenLabs' first ~500-1500ms is otherwise dropped while
// the session warms up. Call this synchronously from the click/tap handler
// before any `await` — the gesture causality must be preserved.
export function unlockAudio(): void {
  try {
    const el = new Audio(SILENT_WAV);
    el.muted = true;
    void el.play().catch(() => {});
  } catch {
    /* no-op on platforms without HTMLAudioElement */
  }
}
