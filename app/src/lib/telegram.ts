type TgWebApp = {
  ready(): void;
  expand(): void;
  initData: string;
  platform: string;
  version: string;
  themeParams: Record<string, string>;
  viewportHeight: number;
  viewportStableHeight: number;
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
};

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp };
  }
}

export const tg = (): TgWebApp | null => window.Telegram?.WebApp ?? null;

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
  if (!isInTelegram()) return;
  const app = tg()!;
  app.ready();
  app.expand();
  try {
    app.setHeaderColor('#0a0908');
    app.setBackgroundColor('#07060a');
  } catch {
    /* older TG clients */
  }
}

const safe = (fn: (app: TgWebApp) => void) => {
  if (!isInTelegram()) return;
  try { fn(tg()!); } catch { /* unsupported in this TG version */ }
};

export const haptic = {
  light:     () => safe((a) => a.HapticFeedback.impactOccurred('light')),
  medium:    () => safe((a) => a.HapticFeedback.impactOccurred('medium')),
  selection: () => safe((a) => a.HapticFeedback.selectionChanged()),
  success:   () => safe((a) => a.HapticFeedback.notificationOccurred('success')),
};
