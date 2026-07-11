import { Capacitor } from '@capacitor/core';
import { isInTelegram } from './telegram';

const WEB_AUTH_ENABLED = (
  import.meta.env.VITE_WEB_AUTH_ENABLED as string | undefined
)?.trim().toLowerCase() === 'true';

/** Only ordinary browser/PWA sessions use Supabase + protected /v1 APIs. */
export const isProtectedWebClient = (): boolean =>
  WEB_AUTH_ENABLED && !Capacitor.isNativePlatform() && !isInTelegram();

/** True when already running as an installed PWA (home-screen launch). */
export const isStandaloneDisplay = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
