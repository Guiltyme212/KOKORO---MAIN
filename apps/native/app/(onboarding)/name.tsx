import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { SOFT_NAMES } from "@domain/answers/answers";
import { KokoroMascot } from "@presentation/components/KokoroMascot";
import { PrimaryButton } from "@presentation/components/PrimaryButton";
import { ProgressDots } from "@presentation/components/ProgressDots";
import { Screen } from "@presentation/components/Screen";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";

export default function NameScreen() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const setPersona = usePersonaStore((s) => s.set);

  const [realName, setRealName] = useState(answers.realName ?? "");
  const [callMe, setCallMe] = useState(answers.callMe);
  const [customSoft, setCustomSoft] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  const canContinue = realName.trim().length > 0 && callMe.trim().length > 0;

  const next = () => {
    if (!canContinue) return;
    setAnswer("realName", realName.trim());
    setAnswer("callMe", callMe.trim());
    setPersona({ callMe: callMe.trim(), realName: realName.trim() });
    router.push("/(onboarding)/feeling");
  };

  return (
    <Screen contentClassName="px-6">
      <View className="items-center pt-4">
        <KokoroMascot source="proud" size={180} />
        <Text className="text-ink font-rounded text-2xl text-center mt-4">
          Before we start — what should I call you?
        </Text>
      </View>

      <View className="mt-6 gap-3">
        <View className="rounded-2xl bg-paper border border-stroke px-4 py-3">
          <Text className="text-muted text-xs">Your real name</Text>
          <TextInput
            value={realName}
            onChangeText={setRealName}
            placeholder="Alice"
            placeholderTextColor="#76715e"
            className="text-ink font-rounded text-lg mt-1"
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View className="rounded-2xl bg-paper border border-stroke px-4 py-3">
          <Text className="text-muted text-xs">Pet name</Text>
          <TextInput
            value={callMe}
            onChangeText={setCallMe}
            placeholder="Babe"
            placeholderTextColor="#76715e"
            className="text-ink font-rounded text-lg mt-1"
            autoCapitalize="words"
          />
        </View>

        <Text className="text-muted text-xs mt-2">Or pick one:</Text>
        <View className="flex-row flex-wrap gap-2">
          {SOFT_NAMES.map((name) => (
            <Pressable
              key={name}
              onPress={() => setCallMe(name)}
              accessibilityRole="button"
              accessibilityState={{ selected: callMe === name }}
            >
              <View
                className={`px-4 py-2 rounded-full border ${
                  callMe === name ? "bg-ink border-ink" : "bg-paper border-stroke"
                }`}
              >
                <Text
                  className={`font-rounded text-sm ${
                    callMe === name ? "text-paper" : "text-ink"
                  }`}
                >
                  {name}
                </Text>
              </View>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setCustomOpen((open) => !open)}
            accessibilityRole="button"
          >
            <View className="px-4 py-2 rounded-full border border-stroke bg-paper">
              <Text className="font-rounded text-sm text-ink">+ Your own…</Text>
            </View>
          </Pressable>
        </View>
        {customOpen ? (
          <View className="flex-row gap-2 mt-2">
            <TextInput
              value={customSoft}
              onChangeText={setCustomSoft}
              placeholder="Custom"
              placeholderTextColor="#76715e"
              className="flex-1 rounded-2xl bg-paper border border-stroke px-4 py-2 text-ink"
            />
            <Pressable
              onPress={() => {
                const trimmed = customSoft.trim();
                if (trimmed) {
                  setCallMe(trimmed);
                  setCustomSoft("");
                  setCustomOpen(false);
                }
              }}
              accessibilityRole="button"
            >
              <View className="px-4 py-2 rounded-full bg-ink">
                <Text className="text-paper font-rounded text-sm">Use</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="items-center gap-3 pt-8 pb-4">
        <ProgressDots active={1} />
        <PrimaryButton onPress={next} disabled={!canContinue}>
          Continue
        </PrimaryButton>
      </View>
    </Screen>
  );
}
