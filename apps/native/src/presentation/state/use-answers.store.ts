import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ANSWERS_DEFAULT, type Answers } from "@domain/answers/answers";
import { asyncStorageJsonStorage } from "./persistence";

type AnswersStore = {
  answers: Answers;
  setAnswer<K extends keyof Answers>(key: K, value: Answers[K]): void;
  reset(): void;
};

export const useAnswersStore = create<AnswersStore>()(
  persist(
    (set) => ({
      answers: ANSWERS_DEFAULT,
      setAnswer: (key, value) =>
        set((state) => ({ answers: { ...state.answers, [key]: value } })),
      reset: () => set({ answers: ANSWERS_DEFAULT }),
    }),
    {
      name: "kokoro_answers",
      storage: asyncStorageJsonStorage,
    },
  ),
);
