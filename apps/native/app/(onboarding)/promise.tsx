import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { buildWeCanPhrase } from "@domain/meditation/we-can-phrase";
import { PrimaryButton } from "@presentation/components/PrimaryButton";
import { ProgressDots } from "@presentation/components/ProgressDots";
import { Screen } from "@presentation/components/Screen";
import { useAnswersStore } from "@presentation/state/use-answers.store";

const TIMES = ["08:00", "12:00", "17:00", "20:00", "22:00"] as const;

export default function PromiseScreen() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const [time, setTime] = useState<string>(answers.reminderTime ?? "20:00");

  const phrase = buildWeCanPhrase(answers.feeling ?? "", answers.source ?? "");
  const name = answers.callMe || answers.realName || "friend";

  const accept = () => {
    setAnswer("reminderTime", time);
    setAnswer("wantsProgram", true);
    router.replace("/(tabs)/home");
  };

  const skip = () => {
    setAnswer("wantsProgram", false);
    router.replace("/(tabs)/home");
  };

  return (
    <Screen contentClassName="px-6">
      <View className="flex-1 items-center justify-center">
        <Text className="text-ink font-rounded text-3xl text-center">
          {name},
        </Text>
        <Text className="text-ink font-rounded text-3xl text-center mb-4">
          I can build you a 14-day program.
        </Text>
        <Text className="text-muted font-body text-base text-center">
          We'll {phrase}.
        </Text>

        <Text className="text-ink font-rounded text-base mt-8">
          Daily reminder
        </Text>
        <View className="flex-row gap-2 mt-3 flex-wrap justify-center">
          {TIMES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTime(t)}
              accessibilityRole="button"
              accessibilityState={{ selected: time === t }}
            >
              <View
                className={`px-4 py-2 rounded-full border ${
                  time === t ? "bg-ink border-ink" : "bg-paper border-stroke"
                }`}
              >
                <Text
                  className={`font-rounded text-sm ${
                    time === t ? "text-paper" : "text-ink"
                  }`}
                >
                  {t}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="items-center gap-3 pb-4">
        <ProgressDots active={4} />
        <PrimaryButton onPress={accept}>Yes, build me one</PrimaryButton>
        <Pressable onPress={skip} accessibilityRole="button">
          <Text className="text-muted font-body text-sm py-2">
            Maybe later
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
