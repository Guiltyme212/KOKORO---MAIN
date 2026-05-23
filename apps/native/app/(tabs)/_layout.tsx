import { Stack, useRouter } from "expo-router";
import { View } from "react-native";

import { TabBar } from "@presentation/components/TabBar";

// We use a custom TabBar (Pressable-based) instead of expo-router's Tabs
// component so the Talk center action can route to /chat (a non-tab route)
// while the remaining tabs stay inside (tabs).

export default function TabsLayout() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-cream">
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="library" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="you" />
      </Stack>
      <TabBar
        active="home"
        onTabPress={(href) => router.replace(href as Parameters<typeof router.replace>[0])}
      />
    </View>
  );
}
