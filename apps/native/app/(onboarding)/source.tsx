import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { SOURCES } from "@domain/meditation/we-can-phrase";
import { KokoroMascot } from "@presentation/components/KokoroMascot";
import { ProgressDots } from "@presentation/components/ProgressDots";
import { Screen } from "@presentation/components/Screen";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";

export default function SourceScreen() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const addTheme = usePersonaStore((s) => s.addTheme);

  const pick = (source: string) => {
    hapticsAdapter.impact("medium");
    setAnswer("source", source);
    const chips = [answers.feeling, source].filter(Boolean) as string[];
    setAnswer("chips", chips);
    if (source !== "No idea") addTheme(source);
    router.push("/chat");
  };

  return (
    <Screen contentClassName="px-6">
      <View className="items-center pt-4">
        <KokoroMascot source="heart" size={180} />
        <Text className="text-ink font-rounded text-2xl text-center mt-4">
          What is this mostly about?
        </Text>
      </View>

      <View className="mt-6 flex-row flex-wrap justify-between">
        {SOURCES.map((source) => (
          <Pressable
            key={source}
            onPress={() => pick(source)}
            className="w-[48%] mb-2"
            accessibilityRole="button"
            accessibilityState={{ selected: answers.source === source }}
          >
            <View
              className={`rounded-2xl border px-4 py-4 items-center ${
                answers.source === source
                  ? "bg-ink border-ink"
                  : "bg-paper border-stroke"
              }`}
            >
              <Text
                className={`font-rounded text-sm ${
                  answers.source === source ? "text-paper" : "text-ink"
                }`}
              >
                {source}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View className="items-center pt-8 pb-4">
        <ProgressDots active={3} />
      </View>
    </Screen>
  );
}
