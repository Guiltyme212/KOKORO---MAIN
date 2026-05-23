import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlayer,
} from "expo-audio";

import type { AudioPlayerPort, AudioPlayerStatus } from "@application/ports/audio-player.port";

// One-time global audio session config — lets playback continue when the
// phone locks and pauses cleanly on phone calls / Siri / alarms. Safe to
// call multiple times; subsequent calls update the existing mode.
let audioModeConfigured = false;
const ensureAudioMode = async (): Promise<void> => {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // doNotMix is required when we want lock-screen controls (Now Playing)
      // and is the right call for a focused-meditation audio session.
      interruptionMode: "doNotMix",
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
  } catch {
    // setAudioModeAsync can throw on web / older runtimes. Non-fatal.
    audioModeConfigured = false;
  }
};

// expo-audio's `useAudioPlayer` hook is React-bound; our port has to be usable
// from non-component code (use cases), so we wrap the imperative `createAudioPlayer`.
export function createExpoAudioPlayer(): AudioPlayerPort {
  let player: AudioPlayer | null = null;
  const listeners = new Set<(status: AudioPlayerStatus) => void>();
  let lastEnded = false;
  let pollId: ReturnType<typeof setInterval> | null = null;
  let currentMeta: AudioMetadata | null = null;

  const emit = (): void => {
    if (!player) return;
    const status: AudioPlayerStatus = {
      isPlaying: player.playing ?? false,
      positionSec: player.currentTime ?? 0,
      durationSec: player.duration ?? 0,
      didEnd: lastEnded,
    };
    listeners.forEach((listener) => listener(status));
  };

  const startPolling = (): void => {
    if (pollId !== null) return;
    pollId = setInterval(() => {
      if (!player) return;
      const dur = player.duration ?? 0;
      const cur = player.currentTime ?? 0;
      if (dur > 0 && cur >= dur - 0.05) lastEnded = true;
      emit();
    }, 250);
  };

  const stopPolling = (): void => {
    if (pollId !== null) {
      clearInterval(pollId);
      pollId = null;
    }
  };

  return {
    async load(uri: string, meta?: { title?: string; artist?: string; artworkUrl?: string }) {
      await ensureAudioMode();
      await this.unload();
      player = createAudioPlayer({ uri });
      lastEnded = false;
      currentMeta = meta
        ? {
            title: meta.title ?? "Kokoro meditation",
            artist: meta.artist ?? "Kokoro",
            artworkUrl: meta.artworkUrl,
          }
        : { title: "Kokoro meditation", artist: "Kokoro" };
      // Activate lock-screen Now Playing controls + metadata.
      try {
        player.setActiveForLockScreen(true, currentMeta);
      } catch {
        /* unsupported platform */
      }
      startPolling();
    },

    async play(): Promise<void> {
      if (!player) return;
      player.play();
      emit();
    },

    async pause(): Promise<void> {
      if (!player) return;
      player.pause();
      emit();
    },

    async seek(positionSec: number): Promise<void> {
      if (!player) return;
      await player.seekTo(positionSec);
      lastEnded = false;
      emit();
    },

    async setPlaybackRate(rate: number): Promise<void> {
      if (!player) return;
      try {
        player.setPlaybackRate(rate);
      } catch {
        /* unsupported platform */
      }
      emit();
    },

    async unload(): Promise<void> {
      stopPolling();
      if (player) {
        try {
          player.setActiveForLockScreen(false);
        } catch {
          /* unsupported platform */
        }
        try {
          player.remove();
        } catch {
          /* already unloaded */
        }
        player = null;
      }
      lastEnded = false;
      currentMeta = null;
    },

    subscribe(listener: (status: AudioPlayerStatus) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
