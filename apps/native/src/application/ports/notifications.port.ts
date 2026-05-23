export type DailyReminderInput = {
  hour: number; // 0..23
  minute: number; // 0..59
  title: string;
  body: string;
  data?: Record<string, string>;
};

export interface NotificationsPort {
  requestPermission(): Promise<boolean>;
  scheduleDailyReminder(input: DailyReminderInput): Promise<string>;
  cancelDailyReminder(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
}
