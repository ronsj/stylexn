"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { Switch, Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  stack: {
    gap: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  box: {
    width: 96,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#6a3db8",
    color: "#ffffff",
    fontWeight: 600,
  },
  second: {
    backgroundColor: "#a987e6",
  },
  // `visibility` is polyfilled on native: hidden becomes opacity 0 without
  // pointer events. As on the web, the box keeps its space.
  hidden: {
    visibility: "hidden",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  },
});

export function VisibilityToggle() {
  const [visible, setVisible] = useState(true);
  return (
    <View sx={styles.stack}>
      <View sx={styles.row}>
        <View sx={[styles.box, !visible && styles.hidden]}>
          <Text>A</Text>
        </View>
        <View sx={[styles.box, styles.second]}>
          <Text>B</Text>
        </View>
      </View>
      <View sx={styles.controls}>
        <Switch value={visible} onValueChange={setVisible} aria-label="Show box A" />
        <Text>visibility: {visible ? "visible" : "hidden"}</Text>
      </View>
    </View>
  );
}
