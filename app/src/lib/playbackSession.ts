import { activatePlaybackSession, deactivatePlaybackSession } from './audioRouteDiagnostics';

// Called while the meditation player is open. The native plugin both:
//  - keeps the screen awake (disables the iOS idle timer) so it can't auto-lock
//  - activates a background-capable `.playback` AVAudioSession so audio survives
//    a manual lock / backgrounding
// Both are scoped to the player and reverted by exitPlaybackMode(). No-op on web.
export async function enterPlaybackMode(): Promise<void> {
  await activatePlaybackSession();
}

export async function exitPlaybackMode(): Promise<void> {
  await deactivatePlaybackSession();
}
