import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Lightweight markdown-ish renderer for legal docs. Keeps the bundle small —
// we don't need react-native-markdown-display for two static screens.

export type LegalBlock =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "meta"; text: string };

type Props = {
  blocks: LegalBlock[];
};

export function LegalScreen({ blocks }: Props) {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text className="text-ink font-rounded">← Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {blocks.map((block, idx) => {
          switch (block.kind) {
            case "h1":
              return (
                <Text
                  key={idx}
                  className="text-ink font-rounded text-3xl mt-4 mb-1"
                  accessibilityRole="header"
                >
                  {block.text}
                </Text>
              );
            case "h2":
              return (
                <Text
                  key={idx}
                  className="text-ink font-rounded text-xl mt-5 mb-1"
                  accessibilityRole="header"
                >
                  {block.text}
                </Text>
              );
            case "p":
              return (
                <Text key={idx} className="text-ink font-body text-base leading-6 mb-2">
                  {block.text}
                </Text>
              );
            case "ul":
              return (
                <View key={idx} className="mb-2 pl-2">
                  {block.items.map((item, j) => (
                    <View key={j} className="flex-row mb-1">
                      <Text className="text-muted font-body text-base mr-2">•</Text>
                      <Text className="flex-1 text-ink font-body text-base leading-6">
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            case "meta":
              return (
                <Text key={idx} className="text-muted font-body text-xs mb-2">
                  {block.text}
                </Text>
              );
          }
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
