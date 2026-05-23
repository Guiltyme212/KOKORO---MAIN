import { Pressable, Text, View } from "react-native";

import { VIBE_CARDS } from "@domain/meditation/vibe-cards";
import type { Vibe } from "@domain/meditation/vibe";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";

type Props = {
  vibe: Vibe;
  selected?: boolean;
  onPress: () => void;
};

export function StyleCard({ vibe, selected = false, onPress }: Props) {
  const card = VIBE_CARDS[vibe];

  return (
    <Pressable
      onPress={() => {
        hapticsAdapter.impact("medium");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${card.title} — ${card.eyebrow}`}
    >
      <View
        className={`rounded-3xl p-5 bg-paper border-2 ${selected ? "border-ink" : "border-stroke"}`}
        style={{
          shadowColor: "#1b1b1b",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: selected ? 0.18 : 0.08,
          shadowRadius: 24,
          elevation: selected ? 8 : 2,
        }}
      >
        <View
          className="self-start rounded-full px-3 py-1 mb-3"
          style={{ backgroundColor: card.accent }}
        >
          <Text className="text-paper font-rounded text-xs">{card.eyebrow}</Text>
        </View>
        <Text className="text-ink font-rounded text-2xl mb-1">{card.title}</Text>
        <Text className="text-muted font-body text-sm">{card.copy}</Text>
      </View>
    </Pressable>
  );
}
