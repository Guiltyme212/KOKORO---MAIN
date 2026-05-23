/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/\\.expo/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@domain/(.*)$": "<rootDir>/src/domain/$1",
    "^@application/(.*)$": "<rootDir>/src/application/$1",
    "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^@presentation/(.*)$": "<rootDir>/src/presentation/$1",
  },
  // Transform everything inside .pnpm (pnpm hoists everything there) plus a
  // belt-and-braces list of RN-flavored packages that ship untranspiled ESM.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm/|(jest-)?react-native|@react-native|@react-native-community|expo|expo-modules-core|@expo|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|react-native-svg|@elevenlabs|@livekit|livekit-client|nativewind|uniwind|heroui-native|react-native-keyboard-controller|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-worklets|react-native-css-interop|msw|@mswjs|rettime|@bundled-es-modules|until-async|outvariant|strict-event-emitter|headers-polyfill|cookie))",
  ],
  testMatch: ["**/__tests__/**/*.test.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
};
