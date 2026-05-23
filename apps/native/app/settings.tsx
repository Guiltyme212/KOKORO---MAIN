import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Screen } from "@presentation/components/Screen";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import { t } from "@presentation/i18n";
import { useCases, ports } from "@presentation/queries/composition-root";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { useAuthStore } from "@presentation/state/use-auth.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";
import { usePreferencesStore } from "@presentation/state/use-preferences.store";

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
  const locale = usePreferencesStore((s) => s.locale);
  const appearance = usePreferencesStore((s) => s.appearance);
  const setPrefLocale = usePreferencesStore((s) => s.setLocale);
  const setAppearance = usePreferencesStore((s) => s.setAppearance);

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
          t("settings.notificationsOffTitle"),
          t("settings.notificationsOffBody"),
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
    Alert.alert(t("settings.signOutConfirmTitle"), t("settings.signOutConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
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
      t("settings.deleteConfirmTitle"),
      t("settings.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
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
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-ink font-rounded">← {t("common.back")}</Text>
        </Pressable>
        <Text className="text-ink font-rounded text-lg">{t("settings.title")}</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text className="text-muted font-body text-xs mt-2 mb-1">{t("settings.reminderHeader")}</Text>
      <View className="rounded-2xl bg-paper border border-stroke px-4 py-3 mb-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink font-rounded text-base">
            {reminderOn
              ? t("settings.on", { time: answers.reminderTime ?? "" })
              : t("settings.off")}
          </Text>
          {reminderOn ? (
            <Pressable
              onPress={cancelReminder}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("settings.turnOff")}
            >
              <Text className="text-sunset font-rounded">{t("settings.turnOff")}</Text>
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

      <Text className="text-muted font-body text-xs mt-3 mb-1">{t("settings.language")}</Text>
      <View className="rounded-2xl bg-paper border border-stroke px-4 py-3 mb-2 flex-row gap-2">
        {(["en", "ru"] as const).map((code) => (
          <Pressable
            key={code}
            onPress={() => {
              setPrefLocale(code);
              hapticsAdapter.impact("light");
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: locale === code }}
          >
            <View
              className={`px-3 py-2 rounded-full border ${
                locale === code ? "bg-ink border-ink" : "bg-cream border-stroke"
              }`}
            >
              <Text
                className={`font-rounded text-sm ${
                  locale === code ? "text-paper" : "text-ink"
                }`}
              >
                {code === "en" ? t("settings.languageEnglish") : t("settings.languageRussian")}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text className="text-muted font-body text-xs mt-3 mb-1">
        {t("settings.appearance")}
      </Text>
      <View className="rounded-2xl bg-paper border border-stroke px-4 py-3 mb-2 flex-row gap-2">
        {(["auto", "light", "dark"] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => {
              setAppearance(mode);
              hapticsAdapter.impact("light");
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: appearance === mode }}
          >
            <View
              className={`px-3 py-2 rounded-full border ${
                appearance === mode ? "bg-ink border-ink" : "bg-cream border-stroke"
              }`}
            >
              <Text
                className={`font-rounded text-sm ${
                  appearance === mode ? "text-paper" : "text-ink"
                }`}
              >
                {mode === "auto"
                  ? t("settings.appearanceAuto")
                  : mode === "light"
                    ? t("settings.appearanceLight")
                    : t("settings.appearanceDark")}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text className="text-muted font-body text-xs mt-3 mb-1">{t("settings.legal")}</Text>
      <Row label={t("settings.privacy")} onPress={() => router.push("/legal/privacy")} />
      <Row label={t("settings.terms")} onPress={() => router.push("/legal/terms")} />

      <Text className="text-muted font-body text-xs mt-3 mb-1">{t("settings.account")}</Text>
      <Row label={t("settings.signOut")} onPress={onSignOut} />
      <Row label={t("settings.deleteAccount")} onPress={onDeleteAccount} danger />

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
