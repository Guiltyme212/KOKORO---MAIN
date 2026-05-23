import * as Notifications from "expo-notifications";

import type {
  DailyReminderInput,
  NotificationsPort,
} from "@application/ports/notifications.port";

// Foreground behavior: still display the banner so the user gets confirmation
// after scheduling.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationsAdapter: NotificationsPort = {
  async requestPermission(): Promise<boolean> {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return next.granted;
  },

  async scheduleDailyReminder(input: DailyReminderInput): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        sound: true,
      },
      // Repeating daily notification.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: input.hour,
        minute: input.minute,
      },
    });
  },

  async cancelDailyReminder(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};

// Listener wiring lives in the layout because it needs the router; expose a
// helper instead of duplicating expo-notifications imports there.
export const addNotificationResponseListener = (
  handler: (data: Record<string, unknown>) => void,
): (() => void) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      handler((response.notification.request.content.data as Record<string, unknown>) ?? {});
    },
  );
  return () => subscription.remove();
};
