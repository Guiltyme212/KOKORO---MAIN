import {
  isErrorEvent,
  isReadyEvent,
  isScriptEvent,
  isStreamingEvent,
  isTransientStreamError,
} from "./stream-event";

describe("StreamEvent guards", () => {
  it("isScriptEvent narrows to script", () => {
    expect(
      isScriptEvent({
        event: "script",
        meditationId: "id",
        lyrics: "",
        style: "",
        vibe: "zen",
        templateId: "",
        generatedAt: "",
      }),
    ).toBe(true);
  });

  it("guards are mutually exclusive across event types", () => {
    const ev = {
      event: "streaming" as const,
      meditationId: "id",
      streamAudioUrl: "x",
      durationSec: 1,
    };
    expect(isStreamingEvent(ev)).toBe(true);
    expect(isScriptEvent(ev)).toBe(false);
    expect(isReadyEvent(ev)).toBe(false);
    expect(isErrorEvent(ev)).toBe(false);
  });
});

describe("isTransientStreamError", () => {
  it("returns true for INTERNAL and UPSTREAM_TIMEOUT prefixes", () => {
    expect(isTransientStreamError(new Error("stream INTERNAL: foo"))).toBe(true);
    expect(isTransientStreamError(new Error("stream UPSTREAM_TIMEOUT: bar"))).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isTransientStreamError(new Error("stream RATE_LIMIT"))).toBe(false);
    expect(isTransientStreamError("random string")).toBe(false);
    expect(isTransientStreamError(null)).toBe(false);
  });
});
