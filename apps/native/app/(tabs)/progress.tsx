import { Text, View } from "react-native";

import { ALL_VIBES } from "@domain/meditation/vibe";
import { VIBE_CARDS } from "@domain/meditation/vibe-cards";
import { Screen } from "@presentation/components/Screen";
import { StreakChart } from "@presentation/components/StreakChart";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { useLibraryQuery } from "@presentation/queries/use-library-query";
import { usePersonaStore } from "@presentation/state/use-persona.store";

export default function ProgressScreen() {
  const progress = useMeditationProgressStore((s) => s.progress);
  const byVibe = useGeneratedMeditationStore((s) => s.byVibe);
  const persona = usePersonaStore((s) => s.persona);
  const libraryQuery = useLibraryQuery();

  const stats = (() => {
    let active = 0;
    let completed = 0;
    for (const vibe of ALL_VIBES) {
      const phase = progress[vibe]?.phase ?? "idle";
      const ready = !!byVibe[vibe]?.audioUrl;
      if (phase === "starting" || phase === "script" || phase === "streaming") active += 1;
      if (phase === "ready" || ready) completed += 1;
    }
    return { active, completed, saved: libraryQuery.data?.length ?? 0 };
  })();

  const streakDays = persona.streakDays ?? 0;
  const sessionDates = persona.sessionDates ?? "";

  return (
    <Screen contentClassName="px-6">
      <Text className="text-ink font-rounded text-3xl py-4">Progress</Text>

      <View className="rounded-2xl bg-paper border border-stroke px-4 py-4 mb-3">
        <View className="flex-row items-baseline justify-between mb-3">
          <View>
            <Text className="text-muted font-body text-xs">Current streak</Text>
            <Text className="text-ink font-rounded text-3xl">
              {streakDays} {streakDays === 1 ? "day" : "days"}
            </Text>
          </View>
          <Text className="text-muted font-body text-xs">last 7 days</Text>
        </View>
        <StreakChart sessionDates={sessionDates} />
      </View>

      <View className="flex-row gap-3 mb-6">
        {[
          ["Completed", String(stats.completed)],
          ["Active", String(stats.active)],
          ["Saved", String(stats.saved)],
        ].map(([label, value]) => (
          <View
            key={label}
            className="flex-1 rounded-2xl bg-paper border border-stroke px-4 py-4 items-center"
          >
            <Text className="text-ink font-rounded text-3xl">{value}</Text>
            <Text className="text-muted font-body text-xs">{label}</Text>
          </View>
        ))}
      </View>

      <View className="gap-2">
        {ALL_VIBES.map((vibe) => {
          const card = VIBE_CARDS[vibe];
          const phase = progress[vibe]?.phase ?? "idle";
          const ready = !!byVibe[vibe]?.audioUrl;
          const status = ready ? "ready" : phase;
          return (
            <View
              key={vibe}
              className="rounded-2xl bg-paper border border-stroke px-4 py-4 flex-row items-center justify-between"
            >
              <View>
                <Text className="text-ink font-rounded text-base">{card.title}</Text>
                <Text className="text-muted font-body text-xs">{card.eyebrow}</Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  status === "ready"
                    ? "bg-moss"
                    : status === "error"
                      ? "bg-sunset"
                      : status === "idle"
                        ? "bg-stroke"
                        : "bg-mustard"
                }`}
              >
                <Text
                  className={`font-body text-xs ${status === "idle" ? "text-ink" : "text-paper"}`}
                >
                  {status}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
