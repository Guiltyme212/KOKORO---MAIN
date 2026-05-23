import { useEffect, useState } from "react";
import { Text } from "react-native";

import { useReducedMotion } from "@presentation/hooks/useReducedMotion";

type Props = {
  names: string[];
  intervalMs?: number;
  className?: string;
};

export function RotatingName({ names, intervalMs = 4000, className }: Props) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Honor the OS reduced-motion preference: just show the first name.
    if (reducedMotion || names.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % names.length), intervalMs);
    return () => clearInterval(id);
  }, [names, intervalMs, reducedMotion]);

  if (names.length === 0) return null;
  return (
    <Text className={className} allowFontScaling>
      {names[reducedMotion ? 0 : index]}
    </Text>
  );
}
