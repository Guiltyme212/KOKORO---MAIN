import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { KokoroMascot } from "@presentation/components/KokoroMascot";
import { PrimaryButton } from "@presentation/components/PrimaryButton";
import { RotatingName } from "@presentation/components/RotatingName";
import { Screen } from "@presentation/components/Screen";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useLibraryQuery } from "@presentation/queries/use-library-query";

export default function HomeScreen() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const persona = usePersonaStore((s) => s.persona);
  const current = useGeneratedMeditationStore((s) => s.current);
  const libraryQuery = useLibraryQuery();

  const callMe = answers.callMe || persona.callMe || "";
  const realName = answers.realName || persona.realName || "";
  const greetingNames = [callMe, realName].filter(Boolean);
  const greetingPool = greetingNames.length > 0 ? greetingNames : ["friend"];

  const recent = (libraryQuery.data ?? []).slice(0, 2);

  return (
    <Screen contentClassName="px-6">
      <View className="pt-4 pb-2">
        <Text className="text-muted font-body text-base">Hello,</Text>
        <RotatingName
          names={greetingPool}
          className="text-ink font-rounded text-4xl"
        />
      </View>

      <View className="items-center py-4">
        <KokoroMascot source="meditate" size={200} />
      </View>

      <PrimaryButton onPress={() => router.push("/chat")}>Talk to Kokoro</PrimaryButton>

      <View className="flex-row gap-3 mt-4">
        <Pressable
          onPress={() => router.push("/quick-reset")}
          className="flex-1"
          accessibilityRole="button"
        >
          <View className="rounded-2xl bg-paper border border-stroke px-4 py-5 items-center">
            <Text className="text-ink font-rounded text-base">60-second reset</Text>
            <Text className="text-muted font-body text-xs mt-1">breath ritual</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push("/sleep")}
          className="flex-1"
          accessibilityRole="button"
        >
          <View className="rounded-2xl bg-paper border border-stroke px-4 py-5 items-center">
            <Text className="text-ink font-rounded text-base">Wind down</Text>
            <Text className="text-muted font-body text-xs mt-1">sleep ritual</Text>
          </View>
        </Pressable>
      </View>

      {current ? (
        <Pressable
          onPress={() => router.push("/player")}
          accessibilityRole="button"
          className="mt-4"
        >
          <View className="rounded-2xl bg-mustard px-4 py-4">
            <Text className="text-ink font-rounded text-base">Continue listening</Text>
            <Text className="text-ink font-body text-sm mt-1">{current.vibe}</Text>
          </View>
        </Pressable>
      ) : null}

      {recent.length > 0 ? (
        <View className="mt-6">
          <Text className="text-muted font-body text-xs mb-2">Recent</Text>
          {recent.map((item) => (
            <Pressable
              key={item.meditationId}
              accessibilityRole="button"
              className="rounded-2xl bg-paper border border-stroke px-4 py-3 mb-2"
              onPress={() => router.push("/(tabs)/library")}
            >
              <Text className="text-ink font-rounded">{item.vibe}</Text>
              <Text className="text-muted font-body text-xs mt-1">
                {item.capturePreview ?? new Date(item.savedAt).toLocaleString()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
