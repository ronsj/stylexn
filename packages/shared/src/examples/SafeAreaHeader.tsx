"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  header: {
    width: 320,
    maxWidth: "100%",
    // The safe-area inset plus 12px. In a browser the inset is 0 except on
    // a notched screen (with viewport-fit=cover); on native it comes from
    // SafeAreaInsetsProvider, and is 0 without one.
    paddingTop: "calc(12px + env(safe-area-inset-top))",
    paddingBottom: 12,
    paddingLeft: "calc(16px + env(safe-area-inset-left))",
    paddingRight: "calc(16px + env(safe-area-inset-right))",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: { default: "#6a3db8", [DARK]: "#4b2a86" },
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: 700,
    color: "#ffffff",
  },
});

export function SafeAreaHeader() {
  return (
    <View sx={styles.header}>
      <Text sx={styles.title}>Clear of the notch and the status bar</Text>
    </View>
  );
}
