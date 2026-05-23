import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";

const OPTIONS = [5, 10, 15, 30] as const;
type Option = (typeof OPTIONS)[number];

type Props = {
  // Caller decides what "stop" means (pause or unload). Sleep timer just
  // counts down; firing the callback is the integration point.
  onFire: () => void;
};

export function SleepTimer({ onFire }: Props) {
  const [active, setActive] = useState<Option | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const onFireRef = useRef(onFire);
  useEffect(() => {
    onFireRef.current = onFire;
  }, [onFire]);

  useEffect(() => {
    if (active == null) return;
    setRemainingSec(active * 60);
    const id = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onFireRef.current();
          setActive(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <View className="items-center mt-2">
      <Text className="text-muted font-body text-xs mb-1">
        {active ? `Sleep in ${fmt(remainingSec)}` : "Sleep timer"}
      </Text>
      <View className="flex-row gap-2">
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => {
              hapticsAdapter.impact("light");
              setActive((prev) => (prev === opt ? null : opt));
            }}
            accessibilityRole="button"
            accessibilityLabel={`${opt} minute sleep timer`}
            accessibilityState={{ selected: active === opt }}
          >
            <View
              className={`px-3 py-1 rounded-full border ${
                active === opt ? "bg-ink border-ink" : "bg-paper border-stroke"
              }`}
            >
              <Text
                className={`font-body text-xs ${
                  active === opt ? "text-paper" : "text-ink"
                }`}
              >
                {opt}m
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
