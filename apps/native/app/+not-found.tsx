import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View className="flex-1 items-center justify-center bg-cream px-6">
        <Text className="text-ink text-2xl font-rounded">This route doesn't exist.</Text>
        <Link href="/" className="text-mustard mt-4 underline">
          Go home
        </Link>
      </View>
    </>
  );
}
