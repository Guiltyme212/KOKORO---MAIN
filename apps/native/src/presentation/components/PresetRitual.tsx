import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import type { Vibe } from "@domain/meditation/vibe";
import { KokoroMascot } from "@presentation/components/KokoroMascot";
import { PrimaryButton } from "@presentation/components/PrimaryButton";
import { Screen } from "@presentation/components/Screen";
import { useAnswersStore } from "@presentation/state/use-answers.store";

type Props = {
  title: string;
  subtitle: string;
  feeling: string;
  source: string;
  vibe: Vibe;
  mascot: "tea" | "meditate" | "float" | "heart" | "proud";
};

export function PresetRitual({ title, subtitle, feeling, source, vibe, mascot }: Props) {
  const router = useRouter();
  const setAnswer = useAnswersStore((s) => s.setAnswer);

  const begin = () => {
    setAnswer("feeling", feeling);
    setAnswer("source", source);
    setAnswer("vibe", vibe);
    setAnswer("chips", [feeling, source]);
    setAnswer("carry", `${title}: ${subtitle}`);
    router.push("/chat");
  };

  return (
    <Screen contentClassName="px-6">
      <View className="flex-1 items-center justify-center">
        <KokoroMascot source={mascot} size={220} />
        <Text className="text-ink font-rounded text-3xl mt-6 text-center">{title}</Text>
        <Text className="text-muted font-body text-base mt-2 text-center">{subtitle}</Text>
      </View>
      <View className="items-center pb-6">
        <PrimaryButton onPress={begin}>Begin</PrimaryButton>
      </View>
    </Screen>
  );
}
