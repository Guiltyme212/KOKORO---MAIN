// Single place where infrastructure adapters are stitched together with
// application use cases. Presentation code (queries, screens) only imports
// from here — never directly from infrastructure. This keeps the layering
// rules tight and makes it easy to swap adapters in tests.

import * as Crypto from "expo-crypto";

import { meditationsApi } from "@infrastructure/api/meditations";
import { elevenlabsApi } from "@infrastructure/api/elevenlabs";
import { libraryApi } from "@infrastructure/api/library";
import { uploadsApi } from "@infrastructure/api/uploads";
import { hapticsAdapter } from "@infrastructure/haptics/expo-haptics";
import { appleAuthAdapter } from "@infrastructure/auth/expo-apple-auth";
import { createExpoAudioPlayer } from "@infrastructure/audio/expo-audio-player";
import { notificationsAdapter } from "@infrastructure/notifications/expo-notifications";

import { listLibrary, removeFromLibrary } from "@application/use-cases/list-library";
import { saveToLibrary } from "@application/use-cases/save-to-library";
import { uploadCapture } from "@application/use-cases/upload-capture";
import { signInWithApple } from "@application/use-cases/sign-in-with-apple";
import { startVoiceSession } from "@application/use-cases/start-voice-session";
import { makeKickoffMeditation } from "@application/use-cases/kickoff-meditation";
import { makeScheduleDailyReminder } from "@application/use-cases/schedule-daily-reminder";

import { useMeditationProgressStore } from "@presentation/state/use-meditation-progress.store";
import { useGeneratedMeditationStore } from "@presentation/state/use-generated-meditation.store";

const delay = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const makeRequestId = () => Crypto.randomUUID();

export const ports = {
  meditationApi: meditationsApi,
  elevenlabs: elevenlabsApi,
  library: libraryApi,
  uploads: uploadsApi,
  haptics: hapticsAdapter,
  appleAuth: appleAuthAdapter,
  audioPlayer: createExpoAudioPlayer,
  notifications: notificationsAdapter,
};

export const useCases = {
  listLibrary: listLibrary({ library: libraryApi }),
  removeFromLibrary: removeFromLibrary({ library: libraryApi }),
  saveToLibrary: saveToLibrary({ library: libraryApi }),
  uploadCapture: uploadCapture({ uploads: uploadsApi }),
  signInWithApple: signInWithApple({ appleAuth: appleAuthAdapter }),
  startVoiceSession: startVoiceSession({ elevenlabs: elevenlabsApi }),
  scheduleDailyReminder: makeScheduleDailyReminder({ notifications: notificationsAdapter }),
};

// kickoff is a long-lived stateful use case (in-flight map per vibe), so we
// hold a single instance bound to the live Zustand stores.
export const kickoffMeditation = makeKickoffMeditation({
  meditationApi: meditationsApi,
  uploads: uploadsApi,
  progress: {
    setVibeProgress: (vibe, partial) =>
      useMeditationProgressStore.getState().setVibe(vibe, partial),
  },
  generated: {
    setForVibe: (vibe, value) =>
      useGeneratedMeditationStore.getState().setForVibe(vibe, value),
    updateForVibe: (vibe, partial) =>
      useGeneratedMeditationStore.getState().updateForVibe(vibe, partial),
  },
  makeRequestId,
  delay,
});
