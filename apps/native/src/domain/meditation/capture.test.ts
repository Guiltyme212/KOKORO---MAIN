import { validateCapture } from "./capture";

describe("validateCapture", () => {
  it("accepts a short text", () => {
    expect(validateCapture({ kind: "text", text: "hi" })).toEqual({ ok: true });
  });

  it("rejects empty text", () => {
    expect(validateCapture({ kind: "text", text: "" })).toEqual({
      ok: false,
      reason: "text capture cannot be empty",
    });
  });

  it("rejects text exceeding 2000 chars", () => {
    expect(validateCapture({ kind: "text", text: "x".repeat(2001) })).toEqual({
      ok: false,
      reason: "text capture exceeds 2000 chars",
    });
  });

  it("accepts theme with 1-6 chips", () => {
    expect(validateCapture({ kind: "theme", chips: ["tired"] })).toEqual({ ok: true });
    expect(
      validateCapture({ kind: "theme", chips: ["a", "b", "c", "d", "e", "f"] }),
    ).toEqual({ ok: true });
  });

  it("rejects theme with 0 chips and >6 chips", () => {
    expect(validateCapture({ kind: "theme", chips: [] }).ok).toBe(false);
    expect(
      validateCapture({ kind: "theme", chips: ["a", "b", "c", "d", "e", "f", "g"] }).ok,
    ).toBe(false);
  });

  it("requires audioUrl and mimeType on voice captures", () => {
    expect(validateCapture({ kind: "voice", audioUrl: "", mimeType: "audio/m4a" }).ok).toBe(false);
    expect(validateCapture({ kind: "voice", audioUrl: "x", mimeType: "" }).ok).toBe(false);
    expect(
      validateCapture({ kind: "voice", audioUrl: "x", mimeType: "audio/m4a" }),
    ).toEqual({ ok: true });
  });
});
