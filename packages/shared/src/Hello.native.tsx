import { StyleSheet, Text } from "react-native";
import { greeting } from "./greeting";

// Native variant, plain RN for now. Once StyleXN exists this file goes
// away and Hello.tsx renders on both platforms.
const styles = StyleSheet.create({
  root: {
    fontSize: 24,
    color: "rebeccapurple",
    padding: 16,
  },
});

export function Hello({ name }: { name: string }) {
  return <Text style={styles.root}>{greeting(name)}</Text>;
}
