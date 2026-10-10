"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  // Views are flex containers with React Native's defaults: a column,
  // items stretched, nothing shrinking unless told to.
  column: {
    width: 300,
    maxWidth: "100%",
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: { default: "#f1ebfb", [DARK]: "#282236" },
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  box: {
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 8,
    backgroundColor: "#6a3db8",
    color: "#ffffff",
    fontWeight: 600,
  },
  one: { flexGrow: 1 },
  two: { flexGrow: 2, backgroundColor: "#8b5fd6" },
  fixed: { width: 64, backgroundColor: "#a987e6" },
});

export function ViewLayout() {
  return (
    <View sx={styles.column}>
      <View sx={styles.box}>
        <Text>Stretched across the column</Text>
      </View>
      <View sx={styles.row}>
        <View sx={[styles.box, styles.one]}>
          <Text>1</Text>
        </View>
        <View sx={[styles.box, styles.two]}>
          <Text>2</Text>
        </View>
        <View sx={[styles.box, styles.fixed]}>
          <Text>64</Text>
        </View>
      </View>
    </View>
  );
}
