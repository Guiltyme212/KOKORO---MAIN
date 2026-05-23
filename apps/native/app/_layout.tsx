import "@/global.css";

import { useFonts } from "expo-font";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { KOKORO_FONT_MAP } from "@presentation/theme/fonts";
import { queryClient, queryPersister } from "@presentation/queries/query-client";

export const unstable_settings = {
  initialRouteName: "(onboarding)",
};

function StackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="player" options={{ presentation: "modal" }} />
      <Stack.Screen name="quick-reset" />
      <Stack.Screen name="sleep" />
    </Stack>
  );
}

export default function Layout() {
  const [fontsLoaded] = useFonts(KOKORO_FONT_MAP);

  if (!fontsLoaded) {
    // Keep the splash visible by rendering a plain cream view until fonts
    // resolve — avoids the FOUT where system font flashes for a frame.
    return <View style={{ flex: 1, backgroundColor: "#f6ebd7" }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              maxAge: 1000 * 60 * 60 * 24,
              buster: "v1",
            }}
          >
            <HeroUINativeProvider>
              <StackLayout />
            </HeroUINativeProvider>
          </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
