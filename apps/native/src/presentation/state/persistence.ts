// Reusable zustand persist storage wired to AsyncStorage. zustand v5's
// `createJSONStorage` accepts a `StateStorage` whose methods can be sync or
// async; AsyncStorage's API matches directly.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, type StateStorage } from "zustand/middleware";

const stateStorage: StateStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const asyncStorageJsonStorage = createJSONStorage(() => stateStorage);
