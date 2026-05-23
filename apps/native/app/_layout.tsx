import "@/global.css";

import { useEffect } from "react";
import { useFonts } from "expo-font";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { KOKORO_FONT_MAP } from "@presentation/theme/fonts";
import { queryClient, queryPersister } from "@presentation/queries/query-client";

// Keep the native splash visible until fonts resolve — avoids a brief
// system-font flash between the splash image and the first rendered screen.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden, or unavailable on web */
});

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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {
        /* splash already hidden */
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Native splash is still visible while fonts load; on web (no native
    // splash) render a plain cream placeholder to avoid a flash.
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
