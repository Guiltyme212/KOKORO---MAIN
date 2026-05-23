import { Text, View } from "react-native";

type Role = "kokoro" | "user" | "system";

type Props = {
  role: Role;
  text: string;
};

export function ChatBubble({ role, text }: Props) {
  if (role === "system") {
    return (
      <View className="self-center my-2">
        <Text className="text-muted font-body text-xs">{text}</Text>
      </View>
    );
  }

  const isUser = role === "user";

  return (
    <View
      className={`my-1 px-4 py-3 rounded-3xl max-w-[80%] ${
        isUser ? "self-end bg-mustard" : "self-start bg-paper"
      }`}
    >
      <Text className={`font-body text-base ${isUser ? "text-ink" : "text-ink"}`}>
        {text}
      </Text>
    </View>
  );
}
