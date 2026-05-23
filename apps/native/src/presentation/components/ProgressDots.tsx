import { View } from "react-native";

type Props = { active: number; total?: number };

export function ProgressDots({ active, total = 5 }: Props) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-3" accessibilityLabel={`step ${active + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          className={
            i === active
              ? "h-2 w-6 rounded-full bg-ink"
              : "h-2 w-2 rounded-full bg-stroke"
          }
        />
      ))}
    </View>
  );
}
