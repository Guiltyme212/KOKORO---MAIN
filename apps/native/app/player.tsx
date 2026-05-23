import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { VIBE_CARDS } from "@domain/meditation/vibe-cards";
import { Screen } from "@presentation/components/Screen";
import { SleepTimer } from "@presentation/components/SleepTimer";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { useSaveToLibraryMutation } from "@presentation/queries/use-library-query";
import { buildLibraryItem, LibraryError } from "@application/use-cases/save-to-library";
import { audioCache } from "@infrastructure/cache/audio-cache";
import { track } from "@infrastructure/observability/analytics";
import { toast } from "@presentation/state/use-toast.store";

const fmt = (sec: number): string => {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// Apply the playback session config once on first mount of the player.
// Mirrors what infrastructure/audio/expo-audio-player.ts does for the
// imperative path; the React hook in this screen uses the global module
// session, so we set it here too.
let audioModeApplied = false;
const ensureAudioMode = (): void => {
  if (audioModeApplied) return;
  audioModeApplied = true;
  setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix",
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
  }).catch(() => {
    audioModeApplied = false;
  });
};

export default function PlayerScreen() {
  const router = useRouter();
  const current = useGeneratedMeditationStore((s) => s.current);
  const answers = useAnswersStore((s) => s.answers);
  const saveMutation = useSaveToLibraryMutation();
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    ensureAudioMode();
  }, []);

  // Try the local cache first; only fall back to the remote URL if the file
  // isn't already on disk. Caching happens lazily on `ready` (see effect
  // below) so subsequent opens of the same meditation play offline.
  const remoteUri = current?.audioUrl || current?.streamAudioUrl || "";
  const audioSource = useMemo(
    () => (current && (cachedUri || remoteUri) ? { uri: cachedUri ?? remoteUri } : null),
    [current, cachedUri, remoteUri],
  );

  useEffect(() => {
    if (!current) return;
    const local = audioCache.localUri(current.meditationId);
    if (local) {
      setCachedUri(local);
      return;
    }
    // Only cache the final mastered audio (not the progressive stream URL).
    if (!current.audioUrl) return;
    let cancelled = false;
    void audioCache.ensure(current.meditationId, current.audioUrl).then((uri) => {
      if (cancelled) return;
      if (uri && uri !== current.audioUrl) setCachedUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [current?.meditationId, current?.audioUrl, current]);

  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);
  const playedOnceRef = useRef(false);

  // Surface Now Playing controls on the lock screen whenever a track is loaded.
  useEffect(() => {
    if (!player || !current) return;
    const card = VIBE_CARDS[current.vibe];
    try {
      player.setActiveForLockScreen(true, {
        title: card.title,
        artist: "Kokoro",
        albumTitle: "Meditation",
      });
    } catch {
      /* unsupported on web */
    }
    return () => {
      try {
        player.setActiveForLockScreen(false);
      } catch {
        /* noop */
      }
    };
  }, [player, current]);

  useEffect(() => {
    if (player && audioSource && !playedOnceRef.current) {
      try {
        player.play();
        playedOnceRef.current = true;
      } catch {
        /* swallow */
      }
    }
  }, [player, audioSource]);

  // When playback completes, return to /promise like the web flow does.
  useEffect(() => {
    if (status?.didJustFinish) {
      router.replace("/(onboarding)/promise");
    }
  }, [status?.didJustFinish, router]);

  const [rate, setRate] = useState<0.75 | 1 | 1.25>(1);

  const applyRate = (next: 0.75 | 1 | 1.25): void => {
    setRate(next);
    if (!player) return;
    try {
      player.setPlaybackRate(next);
    } catch {
      /* unsupported */
    }
  };

  const skip = (deltaSec: number): void => {
    if (!player) return;
    hapticsAdapter.impact("light");
    const next = Math.max(0, Math.min((status?.duration ?? 0) - 0.1, (status?.currentTime ?? 0) + deltaSec));
    player.seekTo(next).catch(() => {
      /* not loaded yet */
    });
  };

  const onSave = () => {
    if (!current) return;
    try {
      const item = buildLibraryItem(current, answers);
      saveMutation.mutate(item, {
        onSuccess: () => {
          hapticsAdapter.notification("success");
          toast("Saved to your library.", "success");
          track("library.saved", { vibe: current.vibe });
        },
        onError: (err) => {
          hapticsAdapter.notification("error");
          toast(err instanceof Error ? err.message : "Could not save.", "error");
        },
      });
    } catch (err) {
      if (err instanceof LibraryError) toast(err.message, "error");
    }
  };

  if (!current) {
    return (
      <Screen scrollable={false}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-rounded text-xl">Nothing to play yet.</Text>
          <Pressable className="mt-4" onPress={() => router.back()} accessibilityRole="button">
            <Text className="text-mustard font-rounded">Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const card = VIBE_CARDS[current.vibe];
  const duration = status?.duration ?? current.durationSec ?? 0;
  const position = status?.currentTime ?? 0;
  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const playing = status?.playing ?? false;

  return (
    <Screen scrollable={false} contentClassName="px-6">
      <View className="flex-row items-center justify-between py-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text className="text-ink font-rounded">← Back</Text>
        </Pressable>
        <Pressable onPress={onSave} disabled={saveMutation.isPending} accessibilityRole="button">
          <Text className="text-mustard font-rounded">
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center">
        <Text className="text-muted font-body text-sm">{card.eyebrow}</Text>
        <Text className="text-ink font-rounded text-3xl mt-2">{card.title}</Text>
      </View>

      <View className="w-full mb-2">
        <View className="h-2 bg-stroke rounded-full overflow-hidden">
          <View className="h-2 bg-ink" style={{ width: `${progressPct}%` }} />
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-muted font-body text-xs">{fmt(position)}</Text>
          <Text className="text-muted font-body text-xs">{fmt(duration)}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-center gap-6 pb-2">
        <Pressable
          onPress={() => skip(-15)}
          accessibilityRole="button"
          accessibilityLabel="Skip back 15 seconds"
        >
          <View className="h-12 w-12 rounded-full bg-paper border border-stroke items-center justify-center">
            <Text className="text-ink font-body text-xs">−15</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            if (playing) player.pause();
            else player.play();
            hapticsAdapter.impact("light");
          }}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause" : "Play"}
        >
          <View className="h-20 w-20 rounded-full bg-mustard items-center justify-center">
            <Text className="text-ink font-rounded text-2xl">{playing ? "❚❚" : "►"}</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => skip(15)}
          accessibilityRole="button"
          accessibilityLabel="Skip forward 15 seconds"
        >
          <View className="h-12 w-12 rounded-full bg-paper border border-stroke items-center justify-center">
            <Text className="text-ink font-body text-xs">+15</Text>
          </View>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-center gap-2 pb-2">
        {([0.75, 1, 1.25] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => applyRate(r)}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${r}x`}
            accessibilityState={{ selected: rate === r }}
          >
            <View
              className={`px-3 py-1 rounded-full border ${
                rate === r ? "bg-ink border-ink" : "bg-paper border-stroke"
              }`}
            >
              <Text
                className={`font-body text-xs ${rate === r ? "text-paper" : "text-ink"}`}
              >
                {r}x
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <SleepTimer
        onFire={() => {
          try {
            player.pause();
          } catch {
            /* unsupported */
          }
        }}
      />
    </Screen>
  );
}
