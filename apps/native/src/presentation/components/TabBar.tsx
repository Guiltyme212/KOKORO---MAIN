import { Pressable, Text, View } from "react-native";

type TabKey = "home" | "library" | "talk" | "progress" | "you";

type Tab = { key: TabKey; label: string; href: string };

const TABS: readonly Tab[] = [
  { key: "home", label: "Home", href: "/(tabs)/home" },
  { key: "library", label: "Library", href: "/(tabs)/library" },
  { key: "talk", label: "Talk", href: "/chat" },
  { key: "progress", label: "Progress", href: "/(tabs)/progress" },
  { key: "you", label: "You", href: "/(tabs)/you" },
];

type Props = {
  active: TabKey;
  onTabPress: (href: string) => void;
};

export function TabBar({ active, onTabPress }: Props) {
  return (
    <View className="flex-row items-center justify-around border-t border-stroke bg-cream pb-2 pt-3">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const isCenter = tab.key === "talk";
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabPress(tab.href)}
            className="flex-1 items-center"
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            {isCenter ? (
              <View className="h-12 w-12 rounded-full bg-mustard items-center justify-center -mt-3">
                <Text className="font-rounded text-ink">Talk</Text>
              </View>
            ) : (
              <Text
                className={`font-body text-xs ${isActive ? "text-ink" : "text-muted"}`}
              >
                {tab.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
