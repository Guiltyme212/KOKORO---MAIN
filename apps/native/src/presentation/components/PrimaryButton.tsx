import { Pressable, Text, View } from "react-native";

import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import type { HapticsPort } from "@application/ports/haptics.port";

type Props = {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: "mustard" | "sunset";
  haptics?: HapticsPort;
};

export function PrimaryButton({
  children,
  onPress,
  disabled = false,
  variant = "mustard",
  haptics = hapticsAdapter,
}: Props) {
  const bg = variant === "sunset" ? "bg-sunset" : "bg-mustard";
  const opacity = disabled ? "opacity-50" : "opacity-100";

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        haptics.impact("light");
        onPress();
      }}
      accessibilityRole="button"
    >
      <View
        className={`rounded-full px-8 py-4 items-center justify-center ${bg} ${opacity}`}
      >
        <Text className="text-ink font-rounded text-base">{children}</Text>
      </View>
    </Pressable>
  );
}
