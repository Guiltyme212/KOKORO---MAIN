import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kokoromind.app',
  appName: 'Kokoro',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'kokoro',
    backgroundColor: '#F6EBD7'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: '#F4EFE6',
      iosSpinnerStyle: 'small',
      showSpinner: false
    },
    Keyboard: {
      resize: 'body',
      style: 'light',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F4EFE6',
      overlaysWebView: true
    },
    CapacitorUpdater: {
      // Disabled for the App Store review build so reviewers always run the
      // bundled web code from this binary, not a stale or mismatched OTA.
      // Re-enable after approval only when the production channel is published
      // from the exact same dist.
      autoUpdate: false,
      version: '1.0.19',
      defaultChannel: 'production',
      resetWhenUpdate: true,
      directUpdate: false,
      responseTimeout: 20,
      appReadyTimeout: 10000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      publicKey: '-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEA0QkL1/nYpNw8GLP860SP6S5uRBGsuCmIANElFYf2vvKVAfubfVlN\nqHRo0FtKYZDk6cUNltpJdMxH227ulohvHTR/Xcc92cGNN0IrF/6gdTMyumdbedLZ\nMIyqu1cTpSupwYj1Jh0K3j66t59Ds64k//+PEVwrANlgaK4Sael84maL8ggdXUlk\naxb+1UeJYGJ93eR0hdEPQfnzh2pGbSEyXpz3Kef50JnISLNa9D4eg/56FRZNCNXL\n5fHitwI/PK8bppHxSiwwDbGWEFSZc8eYVxK6ZFJugXDeIKC36nBwI823g/Gzjqt2\nQMb2oQozoLaAGmPt727co/HZhT/hl9C9VQIDAQAB\n-----END RSA PUBLIC KEY-----\n'
    }
  }
};

export default config;
