import {
  MPLUSRounded1c_400Regular,
  MPLUSRounded1c_500Medium,
  MPLUSRounded1c_700Bold,
  MPLUSRounded1c_800ExtraBold,
} from "@expo-google-fonts/m-plus-rounded-1c";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from "@expo-google-fonts/nunito";

export const KOKORO_FONT_MAP = {
  // M PLUS Rounded 1c — used for headings and Kokoro's display copy.
  MPLUSRounded1c: MPLUSRounded1c_400Regular,
  MPLUSRounded1c_500: MPLUSRounded1c_500Medium,
  MPLUSRounded1c_700: MPLUSRounded1c_700Bold,
  MPLUSRounded1c_800: MPLUSRounded1c_800ExtraBold,

  // Nunito — body copy.
  Nunito_400: Nunito_400Regular,
  Nunito_600: Nunito_600SemiBold,
  Nunito_700: Nunito_700Bold,
  Nunito_800: Nunito_800ExtraBold,
  Nunito_900: Nunito_900Black,
} as const;

export type KokoroFontName = keyof typeof KOKORO_FONT_MAP;
