import * as Sentry from "@sentry/react-native";

// Sentry init for the RN runtime. DSN comes from EXPO_PUBLIC_SENTRY_DSN —
// when unset (every local dev session right now), init() becomes a no-op
// and the rest of the API gracefully degrades.

let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    enableNative: true,
    // Hide PII from breadcrumbs + request bodies.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeBreadcrumb: (breadcrumb) => {
      if (!breadcrumb) return null;
      // Strip ElevenLabs conversation tokens and signed audio URLs from
      // any breadcrumb that captures URLs or messages.
      const scrub = (s: string): string =>
        s
          .replace(/conversationToken=[^&\s]+/gi, "conversationToken=[redacted]")
          .replace(/Authorization:\s*Bearer\s+\S+/gi, "Authorization: Bearer [redacted]")
          .replace(/(https?:\/\/[^\s]*\/(audio|stream)\/[^\s?]+\?)([^\s]+)/gi, "$1[redacted]");
      if (typeof breadcrumb.message === "string") {
        breadcrumb.message = scrub(breadcrumb.message);
      }
      if (breadcrumb.data) {
        for (const k of Object.keys(breadcrumb.data)) {
          const v = breadcrumb.data[k];
          if (typeof v === "string") breadcrumb.data[k] = scrub(v);
        }
      }
      return breadcrumb;
    },
    beforeSend: (event) => {
      // Strip ElevenLabs and audio URLs from event request URLs too.
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/conversationToken=[^&]+/g, "conversationToken=[redacted]");
      }
      return event;
    },
  });
  initialised = true;
}

export const sentryClient = {
  captureException: (err: unknown, context?: Record<string, unknown>): void => {
    if (!initialised) return;
    Sentry.captureException(err, context ? { extra: context } : undefined);
  },
  captureMessage: (msg: string, level: Sentry.SeverityLevel = "info"): void => {
    if (!initialised) return;
    Sentry.captureMessage(msg, level);
  },
};
