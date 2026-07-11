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

/** Meta's in-app browser (Facebook/Instagram/Messenger WebView) — PWA install is impossible there. */
export const isInAppBrowser = (): boolean =>
  /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent);

export const isAndroid = (): boolean => /Android/i.test(navigator.userAgent);

/** intent:// URL that asks Android to open `url` in the default browser instead of the current WebView. */
export const androidIntentUrl = (url: string): string =>
  `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(url)};end`;
