import { useVideoPlayer, VideoView } from "expo-video";
import { View } from "react-native";

type Props = {
  side?: "left" | "right";
  width?: number;
  height?: number;
};

const PEEK_SRC = require("@/assets/kokoro3/kokoro-peek-talk.mp4");

export function VideoPeek({ side = "right", width = 140, height = 200 }: Props) {
  const player = useVideoPlayer(PEEK_SRC, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: "#f6ebd7",
        overflow: "hidden",
        position: "absolute",
        bottom: 80,
        ...(side === "right" ? { right: -40 } : { left: -40 }),
      }}
      pointerEvents="none"
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
