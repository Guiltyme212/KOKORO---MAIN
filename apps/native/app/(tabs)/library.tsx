import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VIBE_CARDS } from "@domain/meditation/vibe-cards";
import { useLibraryQuery } from "@presentation/queries/use-library-query";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";

export default function LibraryScreen() {
  const router = useRouter();
  const libraryQuery = useLibraryQuery();
  const setCurrent = useGeneratedMeditationStore((s) => s.set);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await libraryQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const content = (() => {
    if (libraryQuery.isLoading) {
      return (
        <View className="flex-1 items-center justify-center py-24">
          <Text className="text-muted font-body">Loading…</Text>
        </View>
      );
    }
    if (libraryQuery.error) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-24">
          <Text className="text-sunset font-body text-base">
            {libraryQuery.error.message}
          </Text>
        </View>
      );
    }
    const items = libraryQuery.data ?? [];
    if (items.length === 0) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-24">
          <Text className="text-ink font-rounded text-xl">Nothing saved yet.</Text>
          <Text className="text-muted font-body text-base mt-2 text-center">
            Talk to Kokoro and save your meditation to find it here.
          </Text>
        </View>
      );
    }
    return (
      <>
        <Text className="text-ink font-rounded text-3xl py-4">Library</Text>
        {items.map((item) => {
          const card = VIBE_CARDS[item.vibe];
          return (
            <Pressable
              key={item.meditationId}
              accessibilityRole="button"
              onPress={() => {
                setCurrent({
                  meditationId: item.meditationId,
                  audioUrl: item.audioUrl,
                  durationSec: item.durationSec,
                  style: card.title,
                  lyrics: "",
                  vibe: item.vibe,
                  templateId: "",
                  generatedAt: item.generatedAt,
                  providerMeta: {
                    llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
                    audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
                    persistence: { provider: "", latencyMs: 0 },
                    totalLatencyMs: 0,
                  },
                });
                router.push("/player");
              }}
            >
              <View className="rounded-2xl bg-paper border border-stroke px-4 py-4 mb-3">
                <Text className="text-ink font-rounded text-lg">{card.title}</Text>
                <Text className="text-muted font-body text-xs mt-1">{card.eyebrow}</Text>
                {item.capturePreview ? (
                  <Text className="text-ink font-body text-sm mt-2" numberOfLines={2}>
                    {item.capturePreview}
                  </Text>
                ) : null}
                <Text className="text-muted font-body text-xs mt-2">
                  {new Date(item.savedAt).toLocaleDateString()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </>
    );
  })();

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1b1b1b" />
        }
      >
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}
