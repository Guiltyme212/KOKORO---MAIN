import PostHog from "posthog-react-native";

// Lightweight analytics wrapper. Mirrors the PostHogProvider pattern but
// avoids dragging the React context into use cases. If EXPO_PUBLIC_POSTHOG_KEY
// is not set (typical for dev), every call is a no-op — the app keeps
// working without any analytics network traffic.

let client: PostHog | null = null;

export async function initAnalytics(): Promise<void> {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey || client) return;
  client = new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    captureAppLifecycleEvents: true,
  });
}

// The 5 events the spec calls out plus a couple of useful supplements.
export type AnalyticsEvent =
  | "app.open"
  | "onboarding.completed"
  | "meditation.kickoff"
  | "meditation.ready"
  | "library.saved"
  | "voice.session.started"
  | "voice.session.ended"
  | "reminder.scheduled"
  | "settings.deleteAccount";

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>): void {
  if (!client) return;
  try {
    client.capture(event, properties);
  } catch {
    /* swallow analytics errors */
  }
}

export function identify(userId: string, properties?: Record<string, string | number | boolean>): void {
  if (!client) return;
  try {
    client.identify(userId, properties);
  } catch {
    /* swallow */
  }
}
