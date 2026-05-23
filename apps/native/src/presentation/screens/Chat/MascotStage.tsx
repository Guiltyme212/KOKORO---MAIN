import { View } from "react-native";

import { KokoroMascot } from "@presentation/components/KokoroMascot";

type Emotion = "warm" | "surprised";

type Props = {
  emotion: Emotion;
  size?: number;
};

export function MascotStage({ emotion, size = 200 }: Props) {
  return (
    <View className="items-center justify-center py-3">
      <KokoroMascot source={emotion === "surprised" ? "surprised" : "speaking"} size={size} />
    </View>
  );
}
