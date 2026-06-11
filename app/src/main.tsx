import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { recordError } from './lib/errorLog';
import { answersApi } from './state/answers';
import { personaApi } from './state/persona';
import { hasCompletedLocalProfile } from './lib/profile';

// Silence verbose internal diagnostics (voice / audio-route / OTA) in production
// builds so they don't leak in the shipped App Store / web bundle. warn + error
// are kept for genuine crash diagnostics.
if (import.meta.env.PROD) {
  console.log = console.debug = console.info = () => {};
}

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

// Native (Capacitor) builds run full-screen on every device, iPad included. Flag
// the document so the layout fills the screen with a centered content column
// instead of the desktop browser's small phone-frame card (App Store Guideline 4).
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('is-native');
}

// Last-resort safety net: capture any error that escapes React (async work,
// event handlers, SDK callbacks) so a crash leaves a real trace instead of a
// silent blank. The ErrorBoundary below handles render-time crashes + recovery.
window.addEventListener('error', (event) => {
  if (event.target && event.target !== window) return; // ignore resource (img/script) load errors
  recordError('window.error', event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  recordError('unhandledrejection', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
