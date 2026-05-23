import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import type { AudioPlayerPort, AudioPlayerStatus } from "@application/ports/audio-player.port";

// expo-audio's `useAudioPlayer` hook is React-bound; our port has to be usable
// from non-component code (use cases), so we wrap the imperative `createAudioPlayer`.

export function createExpoAudioPlayer(): AudioPlayerPort {
  let player: AudioPlayer | null = null;
  const listeners = new Set<(status: AudioPlayerStatus) => void>();
  let lastEnded = false;
  let pollId: ReturnType<typeof setInterval> | null = null;

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
    async load(uri: string): Promise<void> {
      await this.unload();
      player = createAudioPlayer({ uri });
      lastEnded = false;
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

    async unload(): Promise<void> {
      stopPolling();
      if (player) {
        try {
          player.remove();
        } catch {
          /* already unloaded */
        }
        player = null;
      }
      lastEnded = false;
    },

    subscribe(listener: (status: AudioPlayerStatus) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
