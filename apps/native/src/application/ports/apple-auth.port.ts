import type { AppleAccount } from "@domain/auth/auth";

export interface AppleAuthPort {
  isAvailable(): Promise<boolean>;
  signIn(): Promise<AppleAccount>;
}
