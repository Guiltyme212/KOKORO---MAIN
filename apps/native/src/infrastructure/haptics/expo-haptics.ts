import * as Haptics from "expo-haptics";

import type {
  HapticImpact,
  HapticNotification,
  HapticsPort,
} from "@application/ports/haptics.port";

const IMPACT_MAP: Record<HapticImpact, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  soft: Haptics.ImpactFeedbackStyle.Soft,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
};

const NOTIFICATION_MAP: Record<HapticNotification, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

export const hapticsAdapter: HapticsPort = {
  impact: (style) => {
    Haptics.impactAsync(IMPACT_MAP[style]).catch(() => {
      /* haptics unavailable */
    });
  },
  notification: (style) => {
    Haptics.notificationAsync(NOTIFICATION_MAP[style]).catch(() => {
      /* haptics unavailable */
    });
  },
};
