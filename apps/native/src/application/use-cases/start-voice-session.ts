import type { Answers } from "@domain/answers/answers";
import type { Persona } from "@domain/persona/persona";
import type { ElevenLabsApiPort } from "@application/ports/elevenlabs.port";
import { buildWeCanPhrase } from "@domain/meditation/we-can-phrase";

export type VoiceSessionOptions = {
  token: string;
  userId: string;
  dynamicVariables: {
    call_me: string;
    main_goal: string;
    source: string;
    we_can_phrase: string;
    is_returning_user: string;
    recurring_themes: string;
    recent_meditations: string;
  };
};

export const buildVoiceSessionOptions = (
  token: string,
  answers: Answers,
  persona: Persona,
): VoiceSessionOptions => ({
  token,
  userId: answers.realName || answers.callMe || persona.callMe || "friend",
  dynamicVariables: {
    call_me: answers.callMe || persona.callMe || "friend",
    main_goal: answers.feeling ?? "",
    source: answers.source ?? "",
    we_can_phrase: buildWeCanPhrase(answers.feeling ?? "", answers.source ?? ""),
    is_returning_user: persona.callMe ? "true" : "false",
    recurring_themes: persona.themes,
    recent_meditations: persona.meditations,
  },
});

export const startVoiceSession =
  ({ elevenlabs }: { elevenlabs: ElevenLabsApiPort }) =>
  async (answers: Answers, persona: Persona): Promise<VoiceSessionOptions> => {
    const token = await elevenlabs.getConversationToken(answers.callMe || answers.realName);
    return buildVoiceSessionOptions(token, answers, persona);
  };
