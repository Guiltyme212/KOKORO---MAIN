import { useEffect, useRef } from "react";
import { ScrollView } from "react-native";

import { ChatBubble } from "@presentation/components/ChatBubble";

export type ChatMessage = {
  id: string;
  role: "kokoro" | "user" | "system";
  text: string;
};

type Props = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: Props) {
  const ref = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  return (
    <ScrollView
      ref={ref}
      className="flex-1 px-4"
      contentContainerStyle={{ paddingVertical: 16 }}
    >
      {messages.map((message) => (
        <ChatBubble key={message.id} role={message.role} text={message.text} />
      ))}
    </ScrollView>
  );
}
