import type { AppleAccount } from "@domain/auth/auth";
import type { AppleAuthPort } from "@application/ports/apple-auth.port";

export const signInWithApple =
  ({ appleAuth }: { appleAuth: AppleAuthPort }) =>
  async (): Promise<AppleAccount> => {
    if (!(await appleAuth.isAvailable())) {
      throw new Error("Apple Sign In is not available on this device.");
    }
    return appleAuth.signIn();
  };
