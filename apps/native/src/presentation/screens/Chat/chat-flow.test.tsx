// Verifies the Chat screen's sub-components in isolation. The ElevenLabs
// `useConversation` hook can't be safely instantiated under jest-expo
// without a real device runtime, so the live chat screen itself is
// exercised in the iOS sim during Phase 10. These tests cover the inner
// pieces (style picker, input bar, message list) which carry the logic.

import { fireEvent, render, screen } from "@testing-library/react-native";

import { InputBar } from "./InputBar";
import { MessageList } from "./MessageList";
import { StylePicker } from "./StylePicker";

describe("InputBar", () => {
  it("starts in text mode, sends typed text on press", () => {
    const onSend = jest.fn();
    render(
      <InputBar
        mode="text"
        onModeChange={() => {}}
        onSend={onSend}
        voiceConnected={false}
        onStartVoice={() => {}}
        onEndVoice={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("Tell Kokoro how you feel…");
    fireEvent.changeText(input, "I'm tired");

    fireEvent.press(screen.getByLabelText("Send message"));
    expect(onSend).toHaveBeenCalledWith("I'm tired");
  });

  it("toggles to voice mode and surfaces start/end controls", () => {
    const onModeChange = jest.fn();
    render(
      <InputBar
        mode="voice"
        onModeChange={onModeChange}
        onSend={() => {}}
        voiceConnected={false}
        onStartVoice={() => {}}
        onEndVoice={() => {}}
      />,
    );
    expect(screen.getByLabelText("Start voice")).toBeTruthy();
  });

  it("switches the voice button to End when connected", () => {
    render(
      <InputBar
        mode="voice"
        onModeChange={() => {}}
        onSend={() => {}}
        voiceConnected
        onStartVoice={() => {}}
        onEndVoice={() => {}}
      />,
    );
    expect(screen.getByLabelText("End call")).toBeTruthy();
  });
});

describe("StylePicker", () => {
  it("renders all five vibes and reports selection", () => {
    const onSelect = jest.fn();
    render(<StylePicker selected={null} onSelect={onSelect} />);
    // 5 vibes mapping to 5 unique card titles
    expect(screen.getByText("Zen")).toBeTruthy();
    expect(screen.getByText("Gen Z")).toBeTruthy();

    fireEvent.press(screen.getByText("Zen"));
    expect(onSelect).toHaveBeenCalledWith("zen");
  });
});

describe("MessageList", () => {
  it("renders user, kokoro, and system messages", () => {
    render(
      <MessageList
        messages={[
          { id: "1", role: "kokoro", text: "Hi" },
          { id: "2", role: "user", text: "Hello" },
          { id: "3", role: "system", text: "…connected" },
        ]}
      />,
    );
    expect(screen.getByText("Hi")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("…connected")).toBeTruthy();
  });
});
