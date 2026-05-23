import { useEffect, useState } from "react";
import { Text } from "react-native";

type Props = {
  names: string[];
  intervalMs?: number;
  className?: string;
};

export function RotatingName({ names, intervalMs = 4000, className }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (names.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % names.length), intervalMs);
    return () => clearInterval(id);
  }, [names, intervalMs]);

  if (names.length === 0) return null;
  return <Text className={className}>{names[index]}</Text>;
}
