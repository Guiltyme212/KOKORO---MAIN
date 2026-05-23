import { create } from "zustand";
import { persist } from "zustand/middleware";

import { AUTH_DEFAULT, type AppleAccount, type AuthState } from "@domain/auth/auth";
import { asyncStorageJsonStorage } from "./persistence";

type AuthStore = {
  auth: AuthState;
  setAppleAccount(account: AppleAccount): void;
  signOut(): void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      auth: AUTH_DEFAULT,
      setAppleAccount: (apple) => set({ auth: { apple, lastProvider: "apple" } }),
      signOut: () => set({ auth: AUTH_DEFAULT }),
    }),
    { name: "kokoro_auth", storage: asyncStorageJsonStorage },
  ),
);
