import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  addTheme as addThemePure,
  PERSONA_DEFAULT,
  type Persona,
  recordMeditation as recordMeditationPure,
} from "@domain/persona/persona";
import { asyncStorageJsonStorage } from "./persistence";

type PersonaStore = {
  persona: Persona;
  set(partial: Partial<Persona>): void;
  addTheme(label: string): void;
  recordMeditation(input: { vibe: string; feeling?: string }): void;
  reset(): void;
};

export const usePersonaStore = create<PersonaStore>()(
  persist(
    (set) => ({
      persona: PERSONA_DEFAULT,
      set: (partial) => set((s) => ({ persona: { ...s.persona, ...partial } })),
      addTheme: (label) => set((s) => ({ persona: addThemePure(s.persona, label) })),
      recordMeditation: (input) =>
        set((s) => ({ persona: recordMeditationPure(s.persona, input) })),
      reset: () => set({ persona: PERSONA_DEFAULT }),
    }),
    { name: "kokoro_persona", storage: asyncStorageJsonStorage },
  ),
);
