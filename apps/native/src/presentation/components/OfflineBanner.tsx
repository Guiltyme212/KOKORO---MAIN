import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Pings expo-network and surfaces a top banner when the device is offline.
// Mounted globally inside _layout so any screen showing in-flight network
// activity has consistent context.

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!mounted) return;
        setOnline(state.isConnected !== false && state.isInternetReachable !== false);
      } catch {
        /* expo-network can throw on simulators without the dev menu reachable */
      }
    };

    void check();
    // Re-check periodically. expo-network has no event-based listener on
    // every platform yet; a 5s poll is cheap and good enough for a banner.
    const id = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (online) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
      }}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View className="bg-sunset px-4 py-1 items-center">
        <Text className="text-paper font-rounded text-xs">You're offline</Text>
      </View>
    </View>
  );
}
