import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): string => Capacitor.getPlatform();

export function initNative(): void {
  if (!isNative()) return;

  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});

  if (platform() === 'ios') {
    void Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => {});
    void Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
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
