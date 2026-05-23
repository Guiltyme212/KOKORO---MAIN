import { type ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

type ScreenProps = ViewProps & {
  children: ReactNode;
  scrollable?: boolean;
  edges?: readonly Edge[];
  scrollViewProps?: Omit<ScrollViewProps, "children" | "contentContainerStyle">;
  contentClassName?: string;
};

const DEFAULT_EDGES: readonly Edge[] = ["top", "left", "right", "bottom"];

export function Screen({
  children,
  scrollable = true,
  edges = DEFAULT_EDGES,
  scrollViewProps,
  contentClassName,
  className,
  ...rest
}: ScreenProps) {
  return (
    <SafeAreaView edges={[...edges]} className={`flex-1 bg-cream ${className ?? ""}`} {...rest}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          {...scrollViewProps}
        >
          <View className={`flex-1 ${contentClassName ?? ""}`}>{children}</View>
        </ScrollView>
      ) : (
        <View className={`flex-1 ${contentClassName ?? ""}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
