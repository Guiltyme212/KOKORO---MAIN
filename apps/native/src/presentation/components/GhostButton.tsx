import { Pressable, Text, View } from "react-native";

import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";

type Props = {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
};

export function GhostButton({ children, onPress, disabled = false }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        hapticsAdapter.impact("light");
        onPress();
      }}
      accessibilityRole="button"
    >
      <View className="rounded-full border border-stroke px-6 py-3 items-center justify-center">
        <Text className="text-ink font-body text-sm">{children}</Text>
      </View>
    </Pressable>
  );
}
