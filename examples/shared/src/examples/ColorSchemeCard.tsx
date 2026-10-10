"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  card: {
    width: 280,
    maxWidth: "100%",
    padding: 20,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: { default: "#fdf6e3", [DARK]: "#073642" },
    borderColor: { default: "#eee8d5", [DARK]: "#0b4a5a" },
    color: { default: "#586e75", [DARK]: "#93a1a1" },
    fontSize: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    // light-dark() compiles to the same prefers-color-scheme condition on native.
    color: "light-dark(#b58900, #2aa198)",
  },
  // Only one of these two is displayed at a time.
  inLight: { display: { default: "flex", [DARK]: "none" } },
  inDark: { display: { default: "none", [DARK]: "flex" } },
});

export function ColorSchemeCard() {
  return (
    <View sx={styles.card}>
      <Text sx={styles.title}>Follows the system</Text>
      <Text sx={styles.inLight}>Your device is in light mode. Switch it to dark mode.</Text>
      <Text sx={styles.inDark}>Your device is in dark mode. Switch it to light mode.</Text>
    </View>
  );
}
