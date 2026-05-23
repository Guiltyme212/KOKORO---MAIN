import AsyncStorage from "@react-native-async-storage/async-storage";

import { queryClient } from "@presentation/queries/query-client";

describe("Phase 1 foundation", () => {
  it("constructs a QueryClient with the configured defaults", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(60_000);
    expect(defaults.queries?.gcTime).toBe(1000 * 60 * 60 * 24);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(0);
  });

  it("loads AsyncStorage from the jest mock and round-trips a value", async () => {
    await AsyncStorage.setItem("foundation_smoke", "ok");
    await expect(AsyncStorage.getItem("foundation_smoke")).resolves.toBe("ok");
  });
});
