export type AppleAccount = {
  userId: string;
  email?: string;
  fullName?: string;
  identityToken?: string;
};

export type AuthProvider = "apple";

export type AuthState = {
  apple?: AppleAccount;
  lastProvider?: AuthProvider;
};

export const AUTH_DEFAULT: AuthState = {};
