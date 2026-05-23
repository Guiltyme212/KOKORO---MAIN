import { PERSONA_DEFAULT, type Persona } from "@domain/persona/persona";
import { asyncStorageAdapter, JsonRepository } from "./async-storage";

export const PERSONA_STORAGE_KEY = "kokoro_persona";

export const personaRepository = new JsonRepository<Persona>(
  asyncStorageAdapter,
  PERSONA_STORAGE_KEY,
  PERSONA_DEFAULT,
);
