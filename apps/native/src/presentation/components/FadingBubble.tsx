import { useEffect, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@presentation/hooks/useReducedMotion";
import { ChatBubble } from "./ChatBubble";

type Role = "kokoro" | "user";

type Message = { id: string; text: string };

type Props = {
  role: Role;
  message: Message | undefined;
};

// Mirrors apps/web's FadingBubble: keeps the previous message on-screen long
// enough to animate out before swapping to the next one.
export function FadingBubble({ role, message }: Props) {
  const [displayed, setDisplayed] = useState<Message | null>(message ?? null);
  const opacity = useSharedValue(1);
  const pending = useRef<Message | null>(null);
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 200;

  useEffect(() => {
    if (!message) return;
    if (displayed && displayed.id === message.id) return;

    if (!displayed) {
      setDisplayed(message);
      opacity.value = withTiming(1, { duration });
      return;
    }

    pending.current = message;
    opacity.value = withTiming(0, { duration }, () => {
      const next = pending.current;
      pending.current = null;
      if (next) {
        setDisplayed(next);
        opacity.value = withTiming(1, { duration });
      }
    });
  }, [message?.id, message?.text, displayed?.id, message, displayed, opacity, duration]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!displayed) return null;
  return (
    <Animated.View style={animStyle}>
      <ChatBubble role={role} text={displayed.text} />
    </Animated.View>
  );
}
