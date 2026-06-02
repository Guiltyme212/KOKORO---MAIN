import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import { answersApi } from './state/answers';
import { personaApi } from './state/persona';
import { hasCompletedLocalProfile } from './lib/profile';

// After a long lock/background, iOS can reload the WKWebView and reset the hash
// to the default welcome screen — even though auth + profile persist in
// localStorage — which reads to the user as being "logged out". Before React
// mounts (so the router reads the corrected hash), send a returning user with a
// completed local profile straight to Home. Explicit deep links are respected.
function restoreLaunchRoute(): void {
  const hash = window.location.hash;
  if (hash && hash !== '#welcome') return;
  if (hasCompletedLocalProfile(answersApi.getSnapshot(), personaApi.getSnapshot())) {
    window.location.replace('#home');
  }
}

restoreLaunchRoute();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void (async () => {
  const appReady = CapacitorUpdater.notifyAppReady();
  if (Capacitor.isNativePlatform()) {
    const [ready, current, builtin, channel] = await Promise.allSettled([
      appReady,
      CapacitorUpdater.current(),
      CapacitorUpdater.getBuiltinVersion(),
      CapacitorUpdater.getChannel(),
    ]);
    console.log('[capgo] startup bundle state', { ready, current, builtin, channel });
    return;
  }
  await appReady.catch(() => {});
})();
