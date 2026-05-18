export type TgUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

type TgWebApp = {
  ready(): void;
  expand(): void;
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
  onEvent(eventType: string, eventHandler: () => void): void;
  offEvent(eventType: string, eventHandler: () => void): void;
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
