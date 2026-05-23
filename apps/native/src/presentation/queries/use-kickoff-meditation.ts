import { useCallback } from "react";

import type { ClientInfo, Locale } from "@domain/meditation/generate-meditation";
import type { Vibe } from "@domain/meditation/vibe";
import type { CaptureBlob } from "@application/ports/uploads.port";
import { useAnswersStore } from "@presentation/state/use-answers.store";
import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";
import { kickoffMeditation } from "./composition-root";

const DEFAULT_CLIENT: ClientInfo = { source: "native" };

export type UseKickoffMeditationOptions = {
  locale?: Locale;
  client?: ClientInfo;
};

// Streaming + multi-phase progress doesn't fit React Query's mutation
// contract cleanly, so this hook is a thin custom wrapper over the Zustand
// stores + the application-level kickoff use case.
export const useKickoffMeditation = (options: UseKickoffMeditationOptions = {}) => {
  const progress = useMeditationProgressStore((s) => s.progress);
  const generatedByVibe = useGeneratedMeditationStore((s) => s.byVibe);
  const answers = useAnswersStore((s) => s.answers);

  const start = useCallback(
    (vibe: Vibe, recordedBlob: CaptureBlob | null = null) =>
      kickoffMeditation.kickoff({
        vibe,
        answers,
        recordedBlob,
        locale: options.locale ?? "en",
        client: options.client ?? DEFAULT_CLIENT,
      }),
    [answers, options.locale, options.client],
  );

  return { start, progress, generatedByVibe };
};
