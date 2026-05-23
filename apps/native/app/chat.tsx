import { ConversationProvider, useConversation } from "@elevenlabs/react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { ALL_VIBES, type Vibe } from "@domain/meditation/vibe";
import { buildVoiceSessionOptions } from "@application/use-cases/start-voice-session";
import { Screen } from "@presentation/components/Screen";
import { InputBar } from "@presentation/screens/Chat/InputBar";
import { MascotStage } from "@presentation/screens/Chat/MascotStage";
import { MessageList, type ChatMessage } from "@presentation/screens/Chat/MessageList";
import { StylePicker } from "@presentation/screens/Chat/StylePicker";
import { ports } from "@presentation/queries/composition-root";
import { useKickoffMeditation } from "@presentation/queries/use-kickoff-meditation";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { usePersonaStore } from "@presentation/state/use-persona.store";
import { useSaveToLibraryMutation } from "@presentation/queries/use-library-query";
import { buildLibraryItem } from "@application/use-cases/save-to-library";

const INITIAL_KOKORO: ChatMessage = {
  id: "kokoro-greeting",
  role: "kokoro",
  text: "Hi. I'm Kokoro. Tell me what's going on.",
};

function ChatInner() {
  const router = useRouter();
  const answers = useAnswersStore((s) => s.answers);
  const setAnswer = useAnswersStore((s) => s.setAnswer);
  const persona = usePersonaStore((s) => s.persona);
  const recordMeditation = usePersonaStore((s) => s.recordMeditation);
  const generatedByVibe = useGeneratedMeditationStore((s) => s.byVibe);
  const selectVibeAsCurrent = useGeneratedMeditationStore((s) => s.selectVibeAsCurrent);
  const saveToLibrary = useSaveToLibraryMutation();

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_KOKORO]);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [emotion, setEmotion] = useState<"warm" | "surprised">("warm");
  const [showStyles, setShowStyles] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

  const kickoff = useKickoffMeditation();

  // ElevenLabs conversation hook. We pass a token via getConversationToken;
  // the SDK then handles WebSocket lifecycle.
  const conversation = useConversation({
    onConnect: () => setMessages((m) => [...m, sys("…connected to Kokoro")]),
    onDisconnect: () => setMessages((m) => [...m, sys("…disconnected")]),
    onMessage: (msg) => {
      if (!msg) return;
      const text = typeof msg === "string" ? msg : (msg as { message?: string }).message;
      const source = typeof msg === "string" ? "ai" : (msg as { source?: string }).source;
      if (!text) return;
      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-${m.length}`, role: source === "user" ? "user" : "kokoro", text },
      ]);
    },
    onError: (error) => setMessages((m) => [...m, sys(`error: ${String(error)}`)]),
    clientTools: useMemo(
      () => ({
        show_meditation_styles: (params: { suggested?: Vibe }) => {
          if (params?.suggested && ALL_VIBES.includes(params.suggested)) {
            setSelectedVibe(params.suggested);
          }
          setShowStyles(true);
          return "styles shown";
        },
        set_mascot_emotion: (params: { emotion?: "warm" | "surprised" }) => {
          setEmotion(params?.emotion === "surprised" ? "surprised" : "warm");
          return "emotion set";
        },
      }),
      [],
    ),
  });

  const startVoice = useCallback(async () => {
    try {
      const token = await ports.elevenlabs.getConversationToken(
        answers.callMe || answers.realName,
      );
      const options = buildVoiceSessionOptions(token, answers, persona);
      conversation.startSession({
        conversationToken: options.token,
        userId: options.userId,
        dynamicVariables: options.dynamicVariables,
      } as Parameters<typeof conversation.startSession>[0]);
    } catch (err) {
      setMessages((m) => [...m, sys(`could not start voice: ${(err as Error).message}`)]);
    }
  }, [answers, persona, conversation]);

  const endVoice = useCallback(() => conversation.endSession(), [conversation]);

  // Auto-save ready meditations to library once each. Mirrors web's auto-save.
  useEffect(() => {
    for (const vibe of ALL_VIBES) {
      const item = generatedByVibe[vibe];
      if (!item || !item.audioUrl) continue;
      if (savedSet.has(item.meditationId)) continue;
      try {
        const libItem = buildLibraryItem(item, answers);
        saveToLibrary.mutate(libItem);
        setSavedSet((s) => new Set([...s, item.meditationId]));
      } catch {
        /* AUDIO_NOT_READY etc — try again next render */
      }
    }
  }, [generatedByVibe, answers, saveToLibrary, savedSet]);

  const sendText = (text: string) => {
    setAnswer("carry", text);
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}-${m.length}`, role: "user", text },
      { id: `${Date.now()}-${m.length + 1}`, role: "kokoro", text: "Got it. Ready to make something for you?" },
    ]);
    setShowStyles(true);
  };

  const pickVibe = async (vibe: Vibe) => {
    setSelectedVibe(vibe);
    setShowStyles(false);
    setAnswer("vibe", vibe);
    recordMeditation({ vibe, feeling: answers.feeling });
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}-${m.length}`, role: "kokoro", text: `Making this in ${vibe} style now. Stay with me.` },
    ]);
    await kickoff.start(vibe, null);

    const ready = useGeneratedMeditationStore.getState().byVibe[vibe];
    if (ready?.audioUrl || ready?.streamAudioUrl) {
      selectVibeAsCurrent(vibe);
      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-${m.length}`, role: "kokoro", text: "I made this for you. You can listen now." },
      ]);
    }
  };

  const playReady = (vibe: Vibe) => {
    selectVibeAsCurrent(vibe);
    router.push("/player");
  };

  return (
    <Screen scrollable={false} contentClassName="px-0">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text className="text-ink font-rounded">← Back</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/(tabs)/home")} accessibilityRole="button">
          <Text className="text-muted font-body text-sm">Wrap up</Text>
        </Pressable>
      </View>

      <MascotStage emotion={emotion} />

      <MessageList messages={messages} />

      {(() => {
        const readyVibe = ALL_VIBES.find(
          (v) => generatedByVibe[v]?.audioUrl || generatedByVibe[v]?.streamAudioUrl,
        );
        if (!readyVibe) return null;
        return (
          <Pressable onPress={() => playReady(readyVibe)} accessibilityRole="button">
            <View className="mx-4 mb-2 rounded-2xl bg-mustard items-center py-3">
              <Text className="text-ink font-rounded">Listen to your meditation</Text>
            </View>
          </Pressable>
        );
      })()}

      <InputBar
        mode={mode}
        onModeChange={setMode}
        onSend={sendText}
        voiceConnected={conversation.status === "connected"}
        onStartVoice={startVoice}
        onEndVoice={endVoice}
      />

      <Modal visible={showStyles} animationType="slide" transparent onRequestClose={() => setShowStyles(false)}>
        <View className="flex-1 justify-end bg-black/30">
          <StylePicker selected={selectedVibe} onSelect={pickVibe} />
        </View>
      </Modal>
    </Screen>
  );
}

const sys = (text: string): ChatMessage => ({
  id: `sys-${Date.now()}-${Math.random()}`,
  role: "system",
  text,
});

export default function ChatScreen() {
  return (
    <ConversationProvider>
      <ChatInner />
    </ConversationProvider>
  );
}
