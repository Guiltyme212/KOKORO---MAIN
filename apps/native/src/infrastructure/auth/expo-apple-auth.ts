import * as AppleAuthentication from "expo-apple-authentication";

import type { AppleAccount } from "@domain/auth/auth";
import type { AppleAuthPort } from "@application/ports/apple-auth.port";

export const appleAuthAdapter: AppleAuthPort = {
  isAvailable: () => AppleAuthentication.isAvailableAsync(),

  async signIn(): Promise<AppleAccount> {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      userId: credential.user,
      email: credential.email ?? undefined,
      fullName: fullName || undefined,
      identityToken: credential.identityToken ?? undefined,
    };
  },
};
