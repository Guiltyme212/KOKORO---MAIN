import "@/global.css";

import { useEffect } from "react";
import { useFonts } from "expo-font";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { AppState, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { addNotificationResponseListener } from "@infrastructure/notifications/expo-notifications";
import { initAnalytics, track } from "@infrastructure/observability/analytics";
import { initSentry } from "@infrastructure/observability/sentry";
import { OfflineBanner } from "@presentation/components/OfflineBanner";
import { ToastHost } from "@presentation/components/ToastHost";
import { KOKORO_FONT_MAP } from "@presentation/theme/fonts";
import { queryClient, queryPersister } from "@presentation/queries/query-client";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { rehydratePhase } from "@domain/pipeline/transitions";
import type { ProgressState } from "@domain/pipeline/phase";
import type { Vibe } from "@domain/meditation/vibe";

// Bootstrap observability before anything else renders. Both init functions
// are safe no-ops when their DSN/API key env vars are missing (typical for
// local dev — there's no SENTRY_DSN or POSTHOG_KEY in the repo).
initSentry();
initAnalytics().catch(() => {
  /* analytics init failure is non-fatal */
});

// Keep the native splash visible until fonts resolve — avoids a brief
// system-font flash between the splash image and the first rendered screen.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden, or unavailable on web */
});

export const unstable_settings = {
  initialRouteName: "(onboarding)",
};

function StackLayout() {
  const router = useRouter();

  // Notification tap → deep-link to the route encoded in the payload.
  // schedule-daily-reminder.ts sets `{ data: { route: "/chat" } }`.
  useEffect(() => {
    const unsubscribe = addNotificationResponseListener((data) => {
      const route = typeof data.route === "string" ? data.route : "/chat";
      try {
        router.push(route as Parameters<typeof router.push>[0]);
      } catch {
        /* invalid route; ignore */
      }
    });
    return unsubscribe;
  }, [router]);

  // Foreground reconcile: when the user backgrounds the app mid-stream and
  // returns, the NDJSON XHR is long dead. Demote any still-in-flight phases
  // to error so the UI shows a Retry button instead of a permanent spinner.
  // Mirrors what rehydratePhase does at cold start. Tier 1 #12.
  useEffect(() => {
    track("app.open");
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      track("app.open");
      const store = useMeditationProgressStore.getState();
      const next: ProgressState = { ...store.progress };
      let touched = false;
      for (const v of Object.keys(next) as Vibe[]) {
        const before = next[v];
        const after = rehydratePhase(before);
        if (after !== before) {
          next[v] = after;
          touched = true;
        }
      }
      if (touched) {
        // setVibe one-by-one would emit N subscriber calls; cheaper to
        // splice each changed slot through the same setter.
        for (const v of Object.keys(next) as Vibe[]) {
          store.setVibe(v, next[v]);
        }
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="player" options={{ presentation: "modal" }} />
      <Stack.Screen name="quick-reset" />
      <Stack.Screen name="sleep" />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/terms" />
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
              <OfflineBanner />
              <ToastHost />
            </HeroUINativeProvider>
          </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
