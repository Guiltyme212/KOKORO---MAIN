import type {
  GenerateMeditationInput,
  GenerateMeditationOutput,
} from "@domain/meditation/generate-meditation";
import type { StreamEvent } from "@domain/meditation/stream-event";

export type MeditationStreamHandle = {
  events: AsyncIterable<StreamEvent>;
  cancel: () => void;
};

export interface MeditationApiPort {
  generate(input: GenerateMeditationInput): Promise<GenerateMeditationOutput>;
  stream(input: GenerateMeditationInput): MeditationStreamHandle;
}
