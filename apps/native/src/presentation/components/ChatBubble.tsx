import { Text, View } from "react-native";

type Role = "kokoro" | "user" | "system";

type Props = {
  role: Role;
  text: string;
};

const a11yLabelFor = (role: Role): string => {
  if (role === "user") return "You said";
  if (role === "kokoro") return "Kokoro said";
  return "Status update";
};

export function ChatBubble({ role, text }: Props) {
  if (role === "system") {
    return (
      <View
        className="self-center my-2"
        accessibilityRole="text"
        accessibilityLabel={`${a11yLabelFor(role)}: ${text}`}
        accessibilityLiveRegion="polite"
      >
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
      accessibilityRole="text"
      accessibilityLabel={`${a11yLabelFor(role)}: ${text}`}
      accessibilityLiveRegion={isUser ? "none" : "polite"}
    >
      <Text className="font-body text-base text-ink" allowFontScaling>
        {text}
      </Text>
    </View>
  );
}
