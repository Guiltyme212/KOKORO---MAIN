export type HapticImpact = "light" | "medium" | "heavy" | "soft" | "rigid";
export type HapticNotification = "success" | "warning" | "error";

export interface HapticsPort {
  impact(style: HapticImpact): void;
  notification(style: HapticNotification): void;
}
