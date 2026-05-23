import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import { KokoroMascot } from "@presentation/components/KokoroMascot";
import { PrimaryButton } from "@presentation/components/PrimaryButton";
import { GhostButton } from "@presentation/components/GhostButton";
import { ProgressDots } from "@presentation/components/ProgressDots";
import { Screen } from "@presentation/components/Screen";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";
import { useAuthStore } from "@presentation/state/use-auth.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { useSignInWithAppleMutation } from "@presentation/queries/use-sign-in-with-apple-mutation";
import { toast } from "@presentation/state/use-toast.store";

export default function WelcomeScreen() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const persona = usePersonaStore((s) => s.persona);
  const auth = useAuthStore((s) => s.auth);
  const resetAnswers = useAnswersStore((s) => s.reset);
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const setPersona = usePersonaStore((s) => s.set);
  const resetProgress = useMeditationProgressStore((s) => s.reset);
  const resetGenerated = useGeneratedMeditationStore((s) => s.reset);
  const appleMutation = useSignInWithAppleMutation();

  // Onboarding skip when the user already has a complete profile from a
  // previous session. Tier 1 #9.
  const hasProfile = !!auth.apple && !!persona.callMe && !!answers.feeling && !!answers.source;
  useEffect(() => {
    if (hasProfile) {
      router.replace("/(tabs)/home");
    }
  }, [hasProfile, router]);

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
        setPersona({
          callMe: account.fullName.split(" ")[0] ?? account.fullName,
          realName: account.fullName,
        });
      }
      router.replace("/(onboarding)/name");
    } catch (err) {
      // Cancellation is the common case; only surface other errors.
      const message = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(message)) {
        toast(message, "error");
      }
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
        <View className="flex-row gap-4 mt-2">
          <Pressable
            onPress={() => router.push("/legal/privacy")}
            accessibilityRole="link"
          >
            <Text className="text-muted font-body text-xs underline">Privacy</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/legal/terms")}
            accessibilityRole="link"
          >
            <Text className="text-muted font-body text-xs underline">Terms</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
