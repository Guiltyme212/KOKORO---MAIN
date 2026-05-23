import { ANSWERS_DEFAULT, type Answers } from "@domain/answers/answers";
import { asyncStorageAdapter, JsonRepository } from "./async-storage";

export const ANSWERS_STORAGE_KEY = "kokoro_answers";

export const answersRepository = new JsonRepository<Answers>(
  asyncStorageAdapter,
  ANSWERS_STORAGE_KEY,
  ANSWERS_DEFAULT,
);
