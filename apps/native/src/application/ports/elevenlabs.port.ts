export interface ElevenLabsApiPort {
  getConversationToken(participantName?: string): Promise<string>;
  getConversationSignedUrl(): Promise<string>;
}
