import type {
  DailyReminderInput,
  NotificationsPort,
} from "@application/ports/notifications.port";

export type ScheduleDailyReminderDeps = { notifications: NotificationsPort };

const parseTime = (hhmm: string): { hour: number; minute: number } | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

export type ReminderResult =
  | { ok: true; identifier: string }
  | { ok: false; reason: "permission-denied" | "invalid-time" };

export const makeScheduleDailyReminder =
  ({ notifications }: ScheduleDailyReminderDeps) =>
  async ({
    callMe,
    reminderTime,
    existingIdentifier,
  }: {
    callMe: string;
    reminderTime: string;
    existingIdentifier?: string | null;
  }): Promise<ReminderResult> => {
    const parsed = parseTime(reminderTime);
    if (!parsed) return { ok: false, reason: "invalid-time" };

    const granted = await notifications.requestPermission();
    if (!granted) return { ok: false, reason: "permission-denied" };

    if (existingIdentifier) {
      await notifications.cancelDailyReminder(existingIdentifier).catch(() => {
        /* identifier may already be gone */
      });
    }

    const friendly = callMe.trim() || "friend";
    const input: DailyReminderInput = {
      hour: parsed.hour,
      minute: parsed.minute,
      title: `Kokoro is here, ${friendly}.`,
      body: "Two minutes for yourself. Tap to talk.",
      data: { route: "/chat" },
    };
    const identifier = await notifications.scheduleDailyReminder(input);
    return { ok: true, identifier };
  };
