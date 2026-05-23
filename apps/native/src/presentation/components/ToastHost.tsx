import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastStore, type ToastTone } from "@presentation/state/use-toast.store";

const DURATION_MS = 3500;

const toneStyle: Record<ToastTone, { bg: string; text: string }> = {
  info: { bg: "bg-ink", text: "text-paper" },
  success: { bg: "bg-moss", text: "text-paper" },
  error: { bg: "bg-sunset", text: "text-paper" },
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!current) {
      opacity.value = withTiming(0, { duration: 180 });
      return;
    }
    opacity.value = withTiming(1, { duration: 180 });
    // Action toasts stick until the user taps; auto-dismiss only the
    // notification-style ones.
    if (current.actionLabel) return;
    const id = setTimeout(() => dismiss(), DURATION_MS);
    return () => clearTimeout(id);
  }, [current, opacity, dismiss]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!current) return null;

  const styles = toneStyle[current.tone];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          top: insets.top + 8,
          left: 12,
          right: 12,
        },
        animStyle,
      ]}
    >
      <View
        className={`rounded-2xl px-4 py-3 flex-row items-center justify-between ${styles.bg}`}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Text className={`flex-1 font-body text-sm ${styles.text}`} numberOfLines={3}>
          {current.message}
        </Text>
        {current.actionLabel ? (
          <Pressable
            onPress={() => {
              current.onAction?.();
              dismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={current.actionLabel}
          >
            <Text className={`font-rounded ml-3 ${styles.text}`}>{current.actionLabel}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Text className={`font-rounded ml-3 ${styles.text}`}>✕</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
