import { Text, View } from "react-native";

import { isoToday } from "@domain/persona/persona";

type Props = {
  sessionDates: string;
  days?: number; // number of trailing days to chart (default 7)
};

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Simple 7-day bar chart. Each column is a day; height is 100% if a session
// happened on that day, 20% (a marker stub) otherwise.
export function StreakChart({ sessionDates, days = 7 }: Props) {
  const set = new Set(
    (sessionDates ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const today = new Date();
  const buckets: { iso: string; label: string; hit: boolean }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = isoToday(d);
    buckets.push({ iso, label: DAY_LABELS[d.getDay()], hit: set.has(iso) });
  }

  return (
    <View className="flex-row items-end justify-between gap-1 h-24 mb-1">
      {buckets.map((b) => (
        <View key={b.iso} className="flex-1 items-center">
          <View
            className={`w-full rounded-md ${b.hit ? "bg-moss" : "bg-stroke"}`}
            style={{ height: b.hit ? "100%" : "12%" }}
            accessibilityLabel={`${b.iso}: ${b.hit ? "session" : "no session"}`}
          />
          <Text className="text-muted font-body text-xs mt-1">{b.label}</Text>
        </View>
      ))}
    </View>
  );
}
