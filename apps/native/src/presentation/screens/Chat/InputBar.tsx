import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";

type Mode = "text" | "voice";

type Props = {
  mode: Mode;
  onModeChange: (next: Mode) => void;
  onSend: (text: string) => void;
  voiceConnected: boolean;
  onStartVoice: () => void;
  onEndVoice: () => void;
};

export function InputBar({
  mode,
  onModeChange,
  onSend,
  voiceConnected,
  onStartVoice,
  onEndVoice,
}: Props) {
  const [draft, setDraft] = useState("");

  const sendDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    hapticsAdapter.impact("light");
    onSend(trimmed);
    setDraft("");
  };

  return (
    <View className="bg-paper border-t border-stroke px-4 py-3">
      <View className="flex-row items-center gap-2 mb-2">
        <Pressable
          onPress={() => onModeChange("text")}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "text" }}
        >
          <View
            className={`px-3 py-1 rounded-full ${
              mode === "text" ? "bg-ink" : "bg-stroke"
            }`}
          >
            <Text
              className={`font-rounded text-xs ${
                mode === "text" ? "text-paper" : "text-ink"
              }`}
            >
              Type
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => onModeChange("voice")}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "voice" }}
        >
          <View
            className={`px-3 py-1 rounded-full ${
              mode === "voice" ? "bg-ink" : "bg-stroke"
            }`}
          >
            <Text
              className={`font-rounded text-xs ${
                mode === "voice" ? "text-paper" : "text-ink"
              }`}
            >
              Voice
            </Text>
          </View>
        </Pressable>
      </View>

      {mode === "text" ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Tell Kokoro how you feel…"
            placeholderTextColor="#76715e"
            className="flex-1 rounded-full bg-cream border border-stroke px-4 py-3 text-ink font-body"
            multiline
            onSubmitEditing={sendDraft}
            blurOnSubmit
          />
          <Pressable
            onPress={sendDraft}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <View
              className={`h-12 w-12 rounded-full items-center justify-center ${
                draft.trim() ? "bg-mustard" : "bg-stroke"
              }`}
            >
              <Text className="text-ink font-rounded">→</Text>
            </View>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row items-center justify-between">
          <Text className="text-muted font-body text-sm">
            {voiceConnected ? "Listening…" : "Tap to talk"}
          </Text>
          <Pressable
            onPress={voiceConnected ? onEndVoice : onStartVoice}
            accessibilityRole="button"
            accessibilityLabel={voiceConnected ? "End call" : "Start voice"}
          >
            <View
              className={`h-12 w-12 rounded-full items-center justify-center ${
                voiceConnected ? "bg-sunset" : "bg-mustard"
              }`}
            >
              <Text className="text-paper font-rounded">{voiceConnected ? "■" : "●"}</Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}
