import type { Answers } from "@domain/answers/answers";
import { PERSONA_DEFAULT } from "@domain/persona/persona";
import { buildVoiceSessionOptions, startVoiceSession } from "./start-voice-session";

const baseAnswers: Answers = {
  callMe: "Babe",
  realName: "Alice",
  carry: "",
  chips: [],
  vibe: "",
  feeling: "Calm me down",
  source: "Work",
};

describe("buildVoiceSessionOptions", () => {
  it("populates dynamic variables from answers and persona", () => {
    const opts = buildVoiceSessionOptions("token", baseAnswers, PERSONA_DEFAULT);
    expect(opts.token).toBe("token");
    expect(opts.userId).toBe("Alice");
    expect(opts.dynamicVariables.call_me).toBe("Babe");
    expect(opts.dynamicVariables.main_goal).toBe("Calm me down");
    expect(opts.dynamicVariables.we_can_phrase).toBe("calm your stress around work");
    expect(opts.dynamicVariables.is_returning_user).toBe("false");
  });

  it("flags returning users when persona has a name", () => {
    const opts = buildVoiceSessionOptions("token", baseAnswers, {
      ...PERSONA_DEFAULT,
      callMe: "Babe",
      themes: "work, sleep",
      meditations: "zen",
    });
    expect(opts.dynamicVariables.is_returning_user).toBe("true");
    expect(opts.dynamicVariables.recurring_themes).toBe("work, sleep");
    expect(opts.dynamicVariables.recent_meditations).toBe("zen");
  });
});

describe("startVoiceSession", () => {
  it("fetches a token and assembles session options", async () => {
    const elevenlabs = {
      getConversationToken: jest.fn(async () => "tkn"),
      getConversationSignedUrl: jest.fn(),
    };
    const out = await startVoiceSession({ elevenlabs })(baseAnswers, PERSONA_DEFAULT);
    expect(elevenlabs.getConversationToken).toHaveBeenCalledWith("Babe");
    expect(out.token).toBe("tkn");
  });
});
