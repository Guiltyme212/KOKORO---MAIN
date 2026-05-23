import { useVideoPlayer, VideoView } from "expo-video";
import { View, type ViewProps } from "react-native";

type MascotSource = "proud" | "tea" | "heart" | "meditate" | "float" | "speaking" | "surprised";

// Mascot videos are cream-on-cream MP4s; the cream-bg wrapper makes them
// blend without needing mix-blend-mode (which RN doesn't support).
const MASCOT_SRC: Record<MascotSource, ReturnType<typeof require>> = {
  proud: require("@/assets/kokoro3/kokoro-proud.mp4"),
  tea: require("@/assets/kokoro3/kokoro-tea.mp4"),
  heart: require("@/assets/kokoro3/kokoro-heart.mp4"),
  meditate: require("@/assets/kokoro3/kokoro-meditate.mp4"),
  float: require("@/assets/kokoro3/kokoro-float.mp4"),
  speaking: require("@/assets/kokoro3/kokoro-chat-speaking.mp4"),
  surprised: require("@/assets/kokoro3/kokoro-chat-surprised.mp4"),
};

type Props = ViewProps & {
  source: MascotSource;
  size?: number;
};

export function KokoroMascot({ source, size = 240, style, ...rest }: Props) {
  const player = useVideoPlayer(MASCOT_SRC[source], (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View
      style={[{ width: size, height: size, backgroundColor: "#f6ebd7" }, style]}
      {...rest}
    >
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}
