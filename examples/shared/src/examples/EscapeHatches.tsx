"use client";

import * as stylex from "stylexn";
import { native, web } from "stylexn";
import { Text, View } from "stylexn/elements";

const styles = stylex.create({
  grid: {
    width: 300,
    maxWidth: "100%",
    gap: 8,
    // React Native has no grid: wrap a row there, use a real grid on the
    // web. Later keys win, so the web block overrides `display`.
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    ...web({
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
    }),
  },
  tile: {
    flexBasis: "30%",
    flexGrow: 1,
    alignItems: "center",
    paddingBlock: 14,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    color: "#3d2a66",
    fontWeight: 600,
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.18)",
    // A React Native-only key for Android's shadow.
    ...native({ elevation: 2 }),
    // A web-only hint, dropped on native without a check.
    ...web({ willChange: "transform" }),
  },
});

export function EscapeHatches() {
  return (
    <View sx={styles.grid}>
      {["A", "B", "C", "D", "E", "F"].map((name) => (
        <View key={name} sx={styles.tile}>
          <Text>{name}</Text>
        </View>
      ))}
    </View>
  );
}
