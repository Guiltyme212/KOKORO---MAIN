import { fireEvent, render, screen } from "@testing-library/react-native";

import { ChatBubble } from "./ChatBubble";
import { GhostButton } from "./GhostButton";
import { PrimaryButton } from "./PrimaryButton";
import { ProgressDots } from "./ProgressDots";
import { RotatingName } from "./RotatingName";
import { StyleCard } from "./StyleCard";

describe("PrimaryButton", () => {
  it("triggers haptic + onPress on press", () => {
    const onPress = jest.fn();
    const impact = jest.fn();
    render(
      <PrimaryButton
        onPress={onPress}
        haptics={{ impact, notification: jest.fn() }}
      >
        Tap me
      </PrimaryButton>,
    );
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith("light");
  });

  it("ignores presses while disabled", () => {
    const onPress = jest.fn();
    const impact = jest.fn();
    render(
      <PrimaryButton
        onPress={onPress}
        disabled
        haptics={{ impact, notification: jest.fn() }}
      >
        Tap me
      </PrimaryButton>,
    );
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
    expect(impact).not.toHaveBeenCalled();
  });
});

describe("GhostButton", () => {
  it("renders its label", () => {
    render(<GhostButton onPress={jest.fn()}>Skip</GhostButton>);
    expect(screen.getByText("Skip")).toBeTruthy();
  });
});

describe("ProgressDots", () => {
  it("exposes an accessibility label with current step", () => {
    render(<ProgressDots active={2} total={5} />);
    expect(screen.getByLabelText("step 3 of 5")).toBeTruthy();
  });
});

describe("ChatBubble", () => {
  it("renders user, kokoro, and system variants", () => {
    render(<ChatBubble role="user" text="hi" />);
    expect(screen.getByText("hi")).toBeTruthy();
    render(<ChatBubble role="kokoro" text="hello" />);
    expect(screen.getByText("hello")).toBeTruthy();
    render(<ChatBubble role="system" text="…connected" />);
    expect(screen.getByText("…connected")).toBeTruthy();
  });
});

describe("StyleCard", () => {
  it("calls onPress and shows vibe copy", () => {
    const onPress = jest.fn();
    render(<StyleCard vibe="zen" onPress={onPress} />);
    expect(screen.getByText("Zen")).toBeTruthy();
    expect(screen.getByText("still - clear")).toBeTruthy();
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("RotatingName", () => {
  it("renders the first name immediately", () => {
    render(<RotatingName names={["Alice", "Bob"]} />);
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("renders nothing when names is empty", () => {
    const { toJSON } = render(<RotatingName names={[]} />);
    expect(toJSON()).toBeNull();
  });
});
