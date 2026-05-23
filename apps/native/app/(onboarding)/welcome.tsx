import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl text-ink font-rounded">Kokoro</Text>
        <Text className="text-base text-muted mt-2">RN port — foundation</Text>
      </View>
    </SafeAreaView>
  );
}
