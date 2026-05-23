import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Screen } from "@presentation/components/Screen";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import { useCases, ports } from "@presentation/queries/composition-root";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { useAuthStore } from "@presentation/state/use-auth.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";

const TIMES = ["08:00", "12:00", "17:00", "20:00", "22:00"] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const resetAnswers = useAnswersStore((s) => s.reset);
  const resetPersona = usePersonaStore((s) => s.reset);
  const resetProgress = useMeditationProgressStore((s) => s.reset);
  const resetGenerated = useGeneratedMeditationStore((s) => s.reset);
  const signOut = useAuthStore((s) => s.signOut);

  const [reminderTime, setReminderTime] = useState(answers.reminderTime ?? "20:00");
  const reminderOn = !!answers.reminderIdentifier;
  const [busy, setBusy] = useState(false);

  const applyReminder = async (next: string) => {
    setBusy(true);
    setReminderTime(next);
    setAnswer("reminderTime", next);
    try {
      const result = await useCases.scheduleDailyReminder({
        callMe: answers.callMe || answers.realName || "friend",
        reminderTime: next,
        existingIdentifier: answers.reminderIdentifier ?? null,
      });
      if (result.ok) {
        setAnswer("reminderIdentifier", result.identifier);
        hapticsAdapter.notification("success");
      } else if (result.reason === "permission-denied") {
        Alert.alert(
          "Notifications are off",
          "Enable Notifications for Kokoro in iOS Settings to schedule a reminder.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelReminder = async () => {
    const existing = answers.reminderIdentifier;
    if (!existing) return;
    setBusy(true);
    try {
      await ports.notifications.cancelDailyReminder(existing);
      setAnswer("reminderIdentifier", undefined);
      hapticsAdapter.impact("light");
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = () => {
    Alert.alert("Sign out?", "Your saved meditations stay on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          signOut();
          router.replace("/(onboarding)/welcome");
        },
      },
    ]);
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This wipes everything Kokoro has saved on this device — your name, answers, library, and reminders. The action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (answers.reminderIdentifier) {
              await ports.notifications
                .cancelDailyReminder(answers.reminderIdentifier)
                .catch(() => undefined);
            }
            await ports.library
              .list()
              .then(async (items) => {
                await Promise.all(
                  items.map((item) => ports.library.remove(item.meditationId)),
                );
              })
              .catch(() => undefined);
            resetAnswers();
            resetPersona();
            resetProgress();
            resetGenerated();
            signOut();
            router.replace("/(onboarding)/welcome");
          },
        },
      ],
    );
  };

  const Row: React.FC<{ label: string; onPress?: () => void; danger?: boolean }> = ({
    label,
    onPress,
    danger,
  }) => (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        hapticsAdapter.impact("light");
        onPress();
      }}
      accessibilityRole="button"
      disabled={!onPress}
    >
      <View className="rounded-2xl bg-paper border border-stroke px-4 py-3 mb-2 flex-row items-center justify-between">
        <Text
          className={`font-rounded text-base ${danger ? "text-sunset" : "text-ink"}`}
        >
          {label}
        </Text>
        <Text className="text-muted font-body">›</Text>
      </View>
    </Pressable>
  );

  return (
    <Screen contentClassName="px-6">
      <View className="flex-row items-center justify-between py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text className="text-ink font-rounded">← Back</Text>
        </Pressable>
        <Text className="text-ink font-rounded text-lg">Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text className="text-muted font-body text-xs mt-2 mb-1">Daily reminder</Text>
      <View className="rounded-2xl bg-paper border border-stroke px-4 py-3 mb-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink font-rounded text-base">
            {reminderOn ? `On at ${answers.reminderTime}` : "Off"}
          </Text>
          {reminderOn ? (
            <Pressable
              onPress={cancelReminder}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Turn off daily reminder"
            >
              <Text className="text-sunset font-rounded">Turn off</Text>
            </Pressable>
          ) : null}
        </View>
        <View className="flex-row gap-2 mt-3 flex-wrap">
          {TIMES.map((t) => (
            <Pressable
              key={t}
              onPress={() => applyReminder(t)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ selected: reminderTime === t }}
            >
              <View
                className={`px-3 py-2 rounded-full border ${
                  reminderTime === t && reminderOn
                    ? "bg-ink border-ink"
                    : "bg-cream border-stroke"
                }`}
              >
                <Text
                  className={`font-rounded text-sm ${
                    reminderTime === t && reminderOn ? "text-paper" : "text-ink"
                  }`}
                >
                  {t}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <Text className="text-muted font-body text-xs mt-3 mb-1">Legal</Text>
      <Row label="Privacy Policy" onPress={() => router.push("/legal/privacy")} />
      <Row label="Terms of Use" onPress={() => router.push("/legal/terms")} />

      <Text className="text-muted font-body text-xs mt-3 mb-1">Account</Text>
      <Row label="Sign out" onPress={onSignOut} />
      <Row label="Delete account" onPress={onDeleteAccount} danger />

      {__DEV__ ? (
        <>
          <Text className="text-muted font-body text-xs mt-3 mb-1">Developer</Text>
          <View className="rounded-2xl bg-paper border border-stroke px-4 py-3">
            <Text className="text-muted font-body text-xs">API base override</Text>
            <TextInput
              value={process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:8787"}
              editable={false}
              className="text-ink font-rounded text-sm mt-1"
              accessibilityLabel="Current API base URL"
            />
            <Text className="text-muted font-body text-xs mt-1">
              Read-only. Set EXPO_PUBLIC_API_BASE in your shell before launching Expo.
            </Text>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
