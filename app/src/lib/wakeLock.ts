// Keep the display from auto-dimming/auto-locking while important foreground work
// is happening: a meditation is generating (so an auto-lock can't suspend the app
// and kill the live NDJSON stream — which surfaces as "Could not reach Kokoro's
// server") and the voice-chat screen is open (so it doesn't sleep between turns
// while the user reads or thinks).
//
// On iOS/Capacitor we drive the NATIVE idle timer (UIApplication.isIdleTimer-
// Disabled) through the audio-route plugin. navigator.wakeLock is NOT reliable
// inside a WKWebView — WebKit implements it via the host app's idle timer, which
// a third-party web view can't reach — so it's only used as a fallback in real
// browsers (plain web / Telegram).
//
// IMPORTANT: this prevents the *automatic* idle lock only. A manual side-button
// lock still suspends the app and drops the stream; generation recovers from that
// on resume (see state/meditationProgress.ts), it cannot be prevented here.

import { Capacitor } from '@capacitor/core';
import { keepScreenAwake, allowScreenSleep } from './audioRouteDiagnostics';

const nativeKeepAwakeAvailable = (): boolean =>
  Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('AudioRouteDiagnostics');

// Several independent features can want the screen awake at the same time. Track
// them by key and only release the lock once the last one lets go.
const holders = new Set<string>();

type Sentinel = {
  release: () => Promise<void>;
  addEventListener?: (type: string, cb: () => void) => void;
};
let webSentinel: Sentinel | null = null;

async function acquireWeb(): Promise<void> {
  if (webSentinel) return;
  const wl = (navigator as unknown as {
    wakeLock?: { request: (type: 'screen') => Promise<Sentinel> };
  }).wakeLock;
  if (!wl?.request) return;
  try {
    const s = await wl.request('screen');
    webSentinel = s;
    // The browser releases it when backgrounded; drop our reference so a return
    // to foreground can re-acquire.
    s.addEventListener?.('release', () => {
      webSentinel = null;
    });
  } catch {
    /* unsupported or denied — fine, just no keep-awake */
  }
}

function releaseWeb(): void {
  const s = webSentinel;
  webSentinel = null;
  void s?.release?.().catch(() => {});
}

// Drive the real keep-awake state to match whether anyone still wants it.
async function reconcile(): Promise<void> {
  const want = holders.size > 0;
  if (nativeKeepAwakeAvailable()) {
    if (want) await keepScreenAwake();
    else await allowScreenSleep();
    return;
  }
  if (want) await acquireWeb();
  else releaseWeb();
}

// Mark or clear a keep-awake request for a named owner (e.g. 'generation',
// 'chat'). Idempotent per owner.
export function setWakeLock(owner: string, wanted: boolean): void {
  if (wanted) {
    if (holders.has(owner)) return;
    holders.add(owner);
  } else {
    if (!holders.delete(owner)) return;
  }
  void reconcile();
}

// Re-assert on return to foreground. On iOS the native plugin already re-applies
// isIdleTimerDisabled on didBecomeActive, so here we only need to re-acquire the
// WEB wake-lock sentinel — the browser always drops it when backgrounded.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      holders.size > 0 &&
      !nativeKeepAwakeAvailable()
    ) {
      void acquireWeb();
    }
  });
}
