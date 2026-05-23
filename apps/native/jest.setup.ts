// Centralised test setup: RTL extended matchers + AsyncStorage mock.
// Per-suite msw lifecycle is wired in infrastructure tests that need HTTP fakes.

import "@testing-library/jest-native/extend-expect";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
