import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { VIBE_CARDS } from "@domain/meditation/vibe-cards";
import { Screen } from "@presentation/components/Screen";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { useSaveToLibraryMutation } from "@presentation/queries/use-library-query";
import { buildLibraryItem, LibraryError } from "@application/use-cases/save-to-library";

const fmt = (sec: number): string => {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function PlayerScreen() {
  const router = useRouter();
  const current = useGeneratedMeditationStore((s) => s.current);
  const answers = useAnswersStore((s) => s.answers);
  const saveMutation = useSaveToLibraryMutation();

  const audioSource = useMemo(
    () => (current ? { uri: current.audioUrl || current.streamAudioUrl || "" } : null),
    [current?.audioUrl, current?.streamAudioUrl, current],
  );

  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);
  const playedOnceRef = useRef(false);

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

  const [saveError, setSaveError] = useState<string | null>(null);

  const onSave = () => {
    if (!current) return;
    try {
      const item = buildLibraryItem(current, answers);
      saveMutation.mutate(item, {
        onSuccess: () => hapticsAdapter.notification("success"),
        onError: () => hapticsAdapter.notification("error"),
      });
    } catch (err) {
      if (err instanceof LibraryError) setSaveError(err.message);
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

      <View className="items-center pb-4">
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
        {saveError ? (
          <Text className="text-sunset font-body text-sm mt-2">{saveError}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
