import { AUTH_DEFAULT, type AuthState } from "@domain/auth/auth";
import { asyncStorageAdapter, JsonRepository } from "./async-storage";

export const AUTH_STORAGE_KEY = "kokoro_auth";

export const authRepository = new JsonRepository<AuthState>(
  asyncStorageAdapter,
  AUTH_STORAGE_KEY,
  AUTH_DEFAULT,
);
