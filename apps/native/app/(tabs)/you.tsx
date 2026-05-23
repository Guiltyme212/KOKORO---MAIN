import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { countPersonaThemes } from "@domain/persona/persona";
import { Screen } from "@presentation/components/Screen";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";
import { useLibraryQuery } from "@presentation/queries/use-library-query";
import { useAuthStore } from "@presentation/state/use-auth.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";

export default function YouScreen() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const persona = usePersonaStore((s) => s.persona);
  const resetAnswers = useAnswersStore((s) => s.reset);
  const resetPersona = usePersonaStore((s) => s.reset);
  const resetProgress = useMeditationProgressStore((s) => s.reset);
  const resetGenerated = useGeneratedMeditationStore((s) => s.reset);
  const signOut = useAuthStore((s) => s.signOut);
  const libraryQuery = useLibraryQuery();

  const callMe =
    answers.callMe ||
    persona.callMe ||
    answers.realName ||
    persona.realName ||
    "friend";

  const themeCount = countPersonaThemes(persona.themes);
  const lastCheckIn = answers.feeling;

  const startOver = () => {
    resetAnswers();
    resetPersona();
    resetProgress();
    resetGenerated();
    signOut();
    router.replace("/(onboarding)/welcome");
  };

  return (
    <Screen contentClassName="px-6">
      <Text className="text-ink font-rounded text-3xl py-4">{callMe}</Text>

      <View className="rounded-2xl bg-paper border border-stroke px-4 py-4">
        <Text className="text-muted font-body text-xs">Recurring themes</Text>
        <Text className="text-ink font-rounded text-base mt-1">
          {persona.themes || "none yet"} ({themeCount})
        </Text>
      </View>

      <View className="rounded-2xl bg-paper border border-stroke px-4 py-4 mt-3">
        <Text className="text-muted font-body text-xs">Saved rituals</Text>
        <Text className="text-ink font-rounded text-base mt-1">
          {libraryQuery.data?.length ?? 0}
        </Text>
      </View>

      <View className="rounded-2xl bg-paper border border-stroke px-4 py-4 mt-3">
        <Text className="text-muted font-body text-xs">Last check-in</Text>
        <Text className="text-ink font-rounded text-base mt-1">
          {lastCheckIn ?? "none yet"}
        </Text>
      </View>

      <View className="gap-3 mt-6">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(onboarding)/name")}
        >
          <View className="rounded-full bg-ink py-3 items-center">
            <Text className="text-paper font-rounded">Edit name</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/chat")}>
          <View className="rounded-full bg-mustard py-3 items-center">
            <Text className="text-ink font-rounded">Talk now</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/settings")}>
          <View className="rounded-full border border-stroke py-3 items-center">
            <Text className="text-ink font-rounded">Settings</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={startOver}>
          <View className="rounded-full border border-stroke py-3 items-center">
            <Text className="text-muted font-body text-sm">Start over</Text>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}
