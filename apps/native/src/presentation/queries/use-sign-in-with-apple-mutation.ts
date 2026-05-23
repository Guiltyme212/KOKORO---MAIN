import { useMutation } from "@tanstack/react-query";

import { useCases } from "./composition-root";
import { useAuthStore } from "@presentation/state/use-auth.store";

export const useSignInWithAppleMutation = () => {
  const setAppleAccount = useAuthStore((s) => s.setAppleAccount);
  return useMutation({
    mutationFn: () => useCases.signInWithApple(),
    onSuccess: (account) => {
      setAppleAccount(account);
    },
  });
};
