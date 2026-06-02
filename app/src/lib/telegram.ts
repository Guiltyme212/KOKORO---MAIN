import { nativeHaptic } from './native';

export type TgUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

type TgInset = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

type TgWebApp = {
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  isFullscreen?: boolean;
  isVersionAtLeast?(version: string): boolean;
  initData: string;
  initDataUnsafe?: {
    user?: TgUser;
    auth_date?: number;
    hash?: string;
    query_id?: string;
    start_param?: string;
  };
  platform: string;
  version: string;
  themeParams: Record<string, string>;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: TgInset;
  contentSafeAreaInset?: TgInset;
  MainButton: {
    setText(text: string): void;
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  onEvent(eventType: string, eventHandler: () => void): void;
  offEvent(eventType: string, eventHandler: () => void): void;
};

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp };
  }
}

export const tg = (): TgWebApp | null => window.Telegram?.WebApp ?? null;

const KOKORO_CREAM = '#F6EBD7';

/**
 * The TG SDK script auto-installs a partial WebApp object in any browser, so
 * `tg()` is non-null even outside Telegram. Real Telegram launches populate
 * `initData` with the signed query string; plain browsers leave it empty.
 */
export const isInTelegram = (): boolean => {
  const app = tg();
  return !!app && !!app.initData;
};

export function initTelegram() {
  installViewportSync();
  if (!isInTelegram()) return;
  const app = tg()!;
  app.ready();
  app.expand();
  try {
    if (!app.isFullscreen && (!app.isVersionAtLeast || app.isVersionAtLeast('8.0'))) {
      app.requestFullscreen?.();
    }
  } catch {
    /* fullscreen is unsupported or denied in this client */
  }
  try {
    app.disableVerticalSwipes?.();
  } catch {
    /* not in Bot API 7.7+ */
  }
  try {
    app.setHeaderColor(KOKORO_CREAM);
    app.setBackgroundColor(KOKORO_CREAM);
    app.setBottomBarColor?.(KOKORO_CREAM);
  } catch {
    /* older TG clients */
  }
}

/**
 * iOS WKWebView (including Telegram Mini App's WebView) reports keyboard
 * occlusion via `window.visualViewport`, not via Telegram's viewportHeight
 * (which doesn't shrink on iOS for the OSK). We write three CSS hooks on
 * `<html>` and let CSS pick up the keyboard state:
 *
 *   --tg-vh             current visual viewport height in px (full or shrunk)
 *   --tg-keyboard-height pixels currently occluded by the OSK
 *   .tg-keyboard-open    boolean class when keyboard height > 60px
 *
 * Then CSS can position bottom-anchored UI with
 *   bottom: var(--tg-keyboard-height, 0px)
 * to lift it above the keyboard, and compact layouts via
 *   html.tg-keyboard-open .some-screen { ... }
 */
function installViewportSync(): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  // The pre-keyboard "natural" viewport height. We capture this lazily on
  // first call and update it ONLY when no input is focused — that way we
  // always have a reference for "how tall the viewport is when there is no
  // keyboard", which we can subtract from to estimate keyboard occlusion
  // even when iOS shrinks both innerHeight and visualViewport.height.
  let baselineH = 0;

  const isEditableFocused = (): boolean => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    return false;
  };

  const update = () => {
    const app = isInTelegram() ? tg() : null;
    const safe = app?.safeAreaInset;
    const contentSafe = app?.contentSafeAreaInset ?? safe;
    const innerH = window.innerHeight;
    const visH = vv?.height ?? innerH;
    const offsetTop = vv?.offsetTop ?? 0;
    const editable = isEditableFocused();

    if (!editable) {
      // Refresh baseline whenever nothing is focused — keeps us correct
      // across orientation changes, Telegram header show/hide, etc.
      baselineH = Math.max(baselineH, visH, innerH);
    }

    // Two signals: (1) visualViewport math (works on most browsers),
    // (2) baseline-minus-current (works when iOS shrinks innerH too).
    const vvKeyboard = Math.max(0, innerH - visH - offsetTop);
    const baseKeyboard = editable && baselineH > 0 ? Math.max(0, baselineH - visH) : 0;
    let keyboardH = Math.max(vvKeyboard, baseKeyboard);
    if (editable && keyboardH < 60) keyboardH = 290; // sensible default if we still can't measure

    root.style.setProperty('--tg-vh', `${visH}px`);
    root.style.setProperty('--tg-keyboard-height', `${keyboardH}px`);
    root.style.setProperty('--tg-safe-top', `${Math.max(0, Math.round(safe?.top ?? 0))}px`);
    root.style.setProperty('--tg-safe-bottom', `${Math.max(0, Math.round(safe?.bottom ?? 0))}px`);
    root.style.setProperty('--tg-content-safe-top', `${Math.max(0, Math.round(contentSafe?.top ?? 0))}px`);
    root.style.setProperty('--tg-content-safe-bottom', `${Math.max(0, Math.round(contentSafe?.bottom ?? 0))}px`);
    root.classList.toggle('tg-keyboard-open', editable || keyboardH > 60);
  };

  update();

  let pending = 0;
  const schedule = () => {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      pending = 0;
      update();
    });
  };

  if (vv) {
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
  } else {
    window.addEventListener('resize', schedule);
  }
  window.addEventListener('orientationchange', schedule);
  const app = isInTelegram() ? tg() : null;
  app?.onEvent?.('viewportChanged', schedule);
  app?.onEvent?.('safeAreaChanged', schedule);
  app?.onEvent?.('contentSafeAreaChanged', schedule);
  app?.onEvent?.('fullscreenChanged', schedule);
  // Focus tracking is the iOS-Telegram-WebView-reliable signal: when an
  // <input>/<textarea> gains focus, the keyboard is opening; on blur it
  // closes. Schedule with a small delay so visualViewport has time to settle.
  document.addEventListener('focusin', () => {
    schedule();
    setTimeout(update, 120);
    setTimeout(update, 320);
  });
  document.addEventListener('focusout', () => {
    schedule();
    setTimeout(update, 120);
    setTimeout(update, 320);
  });
}

const safe = (fn: (app: TgWebApp) => void) => {
  if (!isInTelegram()) return;
  try { fn(tg()!); } catch { /* unsupported in this TG version */ }
};

export const haptic = {
  light:     () => { safe((a) => a.HapticFeedback.impactOccurred('light')); nativeHaptic.light(); },
  medium:    () => { safe((a) => a.HapticFeedback.impactOccurred('medium')); nativeHaptic.medium(); },
  selection: () => { safe((a) => a.HapticFeedback.selectionChanged()); nativeHaptic.selection(); },
  success:   () => { safe((a) => a.HapticFeedback.notificationOccurred('success')); nativeHaptic.success(); },
};

/**
 * Returns the Telegram user when running inside Telegram, otherwise null.
 * The data is unsigned (initDataUnsafe) — fine for analytics/logging,
 * NOT trustworthy for auth without server-side hash verification.
 */
export const tgUser = (): TgUser | null =>
  isInTelegram() ? (tg()!.initDataUnsafe?.user ?? null) : null;

/**
 * Raw signed initData string. Pass this to backend if/when server-side
 * verification is added (HMAC with bot token). Empty string outside Telegram.
 */
export const tgInitData = (): string => tg()?.initData ?? '';
