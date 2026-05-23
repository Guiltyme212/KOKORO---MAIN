import type {
  GenerateMeditationInput,
  GenerateMeditationOutput,
} from "@domain/meditation/generate-meditation";
import type {
  MeditationApiPort,
  MeditationStreamHandle,
} from "@application/ports/meditation-api.port";
import { API_BASE, postJson } from "@infrastructure/http/client";
import { openNdjsonStream } from "@infrastructure/http/ndjson-stream";

export const meditationsApi: MeditationApiPort = {
  generate: (input: GenerateMeditationInput): Promise<GenerateMeditationOutput> =>
    postJson<GenerateMeditationOutput>("/meditations", input),

  stream: (input: GenerateMeditationInput): MeditationStreamHandle =>
    openNdjsonStream({ url: `${API_BASE}/meditations/stream`, body: input }),
};
