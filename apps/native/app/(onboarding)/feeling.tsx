import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { MAIN_GOALS } from "@domain/meditation/we-can-phrase";
import { KokoroMascot } from "@presentation/components/KokoroMascot";
import { ProgressDots } from "@presentation/components/ProgressDots";
import { Screen } from "@presentation/components/Screen";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import { useAnswersStore } from "@presentation/state/use-answers.store";

export default function FeelingScreen() {
  const router = useRouter();
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const feeling = useAnswersStore((s) => s.answers.feeling);

  const pick = (goal: string) => {
    hapticsAdapter.impact("medium");
    setAnswer("feeling", goal);
    setAnswer("chips", [goal]);
    router.push("/(onboarding)/source");
  };

  return (
    <Screen contentClassName="px-6">
      <View className="items-center pt-4">
        <KokoroMascot source="tea" size={180} />
        <Text className="text-ink font-rounded text-2xl text-center mt-4">
          What do you need from me today?
        </Text>
      </View>

      <View className="mt-6 gap-2">
        {MAIN_GOALS.map((goal) => (
          <Pressable
            key={goal}
            onPress={() => pick(goal)}
            accessibilityRole="button"
            accessibilityState={{ selected: feeling === goal }}
          >
            <View
              className={`rounded-2xl border px-5 py-4 ${
                feeling === goal ? "bg-ink border-ink" : "bg-paper border-stroke"
              }`}
            >
              <Text
                className={`font-rounded text-base ${
                  feeling === goal ? "text-paper" : "text-ink"
                }`}
              >
                {goal}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View className="items-center pt-8 pb-4">
        <ProgressDots active={2} />
      </View>
    </Screen>
  );
}
