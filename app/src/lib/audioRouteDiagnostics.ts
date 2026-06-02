import { Capacitor, registerPlugin } from '@capacitor/core';

type RoutePort = {
  name: string;
  type: string;
  uid: string;
  channels?: Array<{
    name: string;
    number: number;
  }>;
};

export type AudioRouteSnapshot = {
  label: string;
  elapsedMs?: number;
  category?: string;
  mode?: string;
  categoryOptions?: string[];
  route?: {
    inputs: RoutePort[];
    outputs: RoutePort[];
  };
  availableInputs?: RoutePort[];
  preferredInput?: RoutePort | null;
  outputVolume?: number;
  sampleRate?: number;
  ioBufferDuration?: number;
  isOtherAudioPlaying?: boolean;
  secondaryAudioShouldBeSilencedHint?: boolean;
  extra?: Record<string, unknown>;
};

type AudioRouteDiagnosticsPlugin = {
  snapshot(options: {
    label: string;
    elapsedMs?: number;
    extra?: Record<string, unknown>;
  }): Promise<AudioRouteSnapshot>;
  // Scoped to the meditation player only: put the AVAudioSession into
  // `.playback` so audio keeps playing when the screen is manually locked /
  // app is backgrounded, then release it on exit. Intentionally NOT a broad
  // app-launch override (see docs/ios-elevenlabs-audio-troubleshooting.md).
  activatePlayback(): Promise<void>;
  deactivatePlayback(): Promise<void>;
};

const AudioRouteDiagnostics = registerPlugin<AudioRouteDiagnosticsPlugin>('AudioRouteDiagnostics');

const playbackSessionAvailable = (): boolean =>
  Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('AudioRouteDiagnostics');

// Activate a background-capable audio session for meditation playback. iOS-only;
// no-op on web/Android. Safe to call repeatedly.
export async function activatePlaybackSession(): Promise<void> {
  if (!playbackSessionAvailable()) return;
  try {
    await AudioRouteDiagnostics.activatePlayback();
  } catch (error) {
    console.warn('[audio-route] activatePlayback failed', error);
  }
}

// Release the playback session when leaving the player so it never bleeds into
// the ElevenLabs voice flow.
export async function deactivatePlaybackSession(): Promise<void> {
  if (!playbackSessionAvailable()) return;
  try {
    await AudioRouteDiagnostics.deactivatePlayback();
  } catch (error) {
    console.warn('[audio-route] deactivatePlayback failed', error);
  }
}

export function logAudioRoute(
  label: string,
  elapsedMs?: number,
  extra?: Record<string, unknown>,
): void {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AudioRouteDiagnostics')) {
    console.log('[audio-route] web/unavailable', { label, elapsedMs, extra });
    return;
  }

  void AudioRouteDiagnostics.snapshot({ label, elapsedMs, extra })
    .then((snapshot) => {
      console.log('[audio-route]', snapshot);
    })
    .catch((error) => {
      console.warn('[audio-route] snapshot failed', { label, elapsedMs, extra, error });
    });
}
