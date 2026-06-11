import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): string => Capacitor.getPlatform();

function isIpadLike(): boolean {
  return (
    /iPad/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function initNative(): void {
  if (!isNative()) return;

  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

  if (platform() === 'ios') {
    // KeyboardResize.None keeps the body at full viewport height — the keyboard
    // simply overlays. We lift the focused input via CSS using --k3-kb-h.
    // With KeyboardResize.Body, both window.innerHeight AND
    // visualViewport.height shrink together, so the App.tsx visualViewport
    // tracker reads kbH=0 and our CSS lift never fires.
    if (!isIpadLike()) {
      void Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
      void Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    }

    const root = document.documentElement;
    void Keyboard.addListener('keyboardWillShow', (info) => {
      root.style.setProperty('--k3-kb-h', `${Math.round(info.keyboardHeight)}px`);
      root.classList.add('k3-kb-open');
    }).catch(() => {});
    void Keyboard.addListener('keyboardWillHide', () => {
      root.style.setProperty('--k3-kb-h', '0px');
      root.classList.remove('k3-kb-open');
    }).catch(() => {});
  }

  document.documentElement.classList.add('native', `native-${platform()}`);

  void SplashScreen.hide({ fadeOutDuration: 320 }).catch(() => {});
}

export const nativeHaptic = {
  light: () => {
    if (!isNative()) return;
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  medium: () => {
    if (!isNative()) return;
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  selection: () => {
    if (!isNative()) return;
    void Haptics.selectionChanged().catch(() => {});
  },
  success: () => {
    if (!isNative()) return;
    void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
};
