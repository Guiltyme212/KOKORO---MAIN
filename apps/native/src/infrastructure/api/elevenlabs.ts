import type { ElevenLabsApiPort } from "@application/ports/elevenlabs.port";
import { getJson } from "@infrastructure/http/client";

export const elevenlabsApi: ElevenLabsApiPort = {
  async getConversationToken(participantName?: string): Promise<string> {
    const qs = participantName?.trim()
      ? `?participantName=${encodeURIComponent(participantName.trim())}`
      : "";
    const body = await getJson<{ token?: unknown }>(`/elevenlabs/conversation-token${qs}`);
    if (typeof body.token !== "string" || !body.token) {
      throw new Error("elevenlabs token missing");
    }
    return body.token;
  },

  async getConversationSignedUrl(): Promise<string> {
    const body = await getJson<{ signedUrl?: unknown }>("/elevenlabs/conversation-signed-url");
    if (typeof body.signedUrl !== "string" || !body.signedUrl) {
      throw new Error("elevenlabs signedUrl missing");
    }
    return body.signedUrl;
  },
};
