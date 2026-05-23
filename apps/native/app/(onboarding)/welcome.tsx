import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { KokoroMascot } from "@presentation/components/KokoroMascot";
import { PrimaryButton } from "@presentation/components/PrimaryButton";
import { GhostButton } from "@presentation/components/GhostButton";
import { ProgressDots } from "@presentation/components/ProgressDots";
import { Screen } from "@presentation/components/Screen";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useSignInWithAppleMutation } from "@presentation/queries/use-sign-in-with-apple-mutation";

export default function WelcomeScreen() {
  const router = useRouter();
  const resetAnswers = useAnswersStore((s) => s.reset);
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const setPersona = usePersonaStore((s) => s.set);
  const resetProgress = useMeditationProgressStore((s) => s.reset);
  const resetGenerated = useGeneratedMeditationStore((s) => s.reset);
  const appleMutation = useSignInWithAppleMutation();

  const beginRitual = () => {
    resetAnswers();
    resetGenerated();
    resetProgress();
    router.replace("/(onboarding)/name");
  };

  const handleApple = async () => {
    try {
      const account = await appleMutation.mutateAsync();
      if (account.fullName) {
        setAnswer("realName", account.fullName);
        setAnswer("callMe", account.fullName.split(" ")[0] ?? account.fullName);
        setPersona({ callMe: account.fullName.split(" ")[0] ?? account.fullName, realName: account.fullName });
      }
      router.replace("/(onboarding)/name");
    } catch {
      // Cancellation is normal; nothing to show. Other errors will appear
      // in the mutation state.
    }
  };

  return (
    <Screen scrollable={false} contentClassName="px-6">
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted font-body text-base mb-2">Welcome to</Text>
        <Text className="text-ink font-rounded text-5xl mb-6">Kokoro</Text>
        <KokoroMascot source="float" size={260} />
      </View>

      <View className="items-center gap-3 pb-4">
        <ProgressDots active={0} />
        <PrimaryButton onPress={beginRitual}>Nice to meet you.</PrimaryButton>
        <GhostButton onPress={handleApple} disabled={appleMutation.isPending}>
          {appleMutation.isPending ? "Signing in…" : "Sign in with Apple"}
        </GhostButton>
        {appleMutation.error ? (
          <Text className="text-sunset font-body text-sm">
            {appleMutation.error.message}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
