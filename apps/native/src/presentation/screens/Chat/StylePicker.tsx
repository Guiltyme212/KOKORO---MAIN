import { ScrollView, Text, View } from "react-native";

import { ALL_VIBES, type Vibe } from "@domain/meditation/vibe";
import { StyleCard } from "@presentation/components/StyleCard";

type Props = {
  selected: Vibe | null;
  onSelect: (vibe: Vibe) => void;
};

export function StylePicker({ selected, onSelect }: Props) {
  return (
    <View className="bg-paper rounded-t-3xl px-5 pt-5 pb-8 border-t border-stroke">
      <Text className="text-ink font-rounded text-xl text-center mb-3">
        Pick a style
      </Text>
      <Text className="text-muted font-body text-center mb-4">
        Each one shapes the voice differently.
      </Text>
      <ScrollView showsVerticalScrollIndicator={false} className="max-h-[420px]">
        <View className="gap-3">
          {ALL_VIBES.map((vibe) => (
            <StyleCard
              key={vibe}
              vibe={vibe}
              selected={selected === vibe}
              onPress={() => onSelect(vibe)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
