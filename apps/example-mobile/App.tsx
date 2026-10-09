import { TodoApp } from "@stylexn/shared";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaInsetsProvider } from "stylexn";

// StyleXN measures nothing: react-native-safe-area-context reports the
// insets, and SafeAreaInsetsProvider hands them to env(safe-area-inset-*).
function Screen() {
  return (
    <SafeAreaInsetsProvider insets={useSafeAreaInsets()}>
      <TodoApp />
      <StatusBar style="auto" />
    </SafeAreaInsetsProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}
