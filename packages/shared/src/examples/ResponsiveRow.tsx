"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const WIDE = "@media (min-width: 700px)";

const styles = stylex.create({
  row: {
    width: "100%",
    gap: 8,
    // A column on narrow windows, a row from 700px up.
    flexDirection: { default: "column", [WIDE]: "row" },
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    paddingBlock: 16,
    borderRadius: 10,
    backgroundColor: "#6a3db8",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 600,
    // Share the row equally; in a column, keep the natural height.
    flexGrow: { default: 0, [WIDE]: 1 },
    flexBasis: { default: "auto", [WIDE]: 0 },
  },
  second: { backgroundColor: "#8b5fd6" },
  third: { backgroundColor: "#a987e6" },
});

export function ResponsiveRow() {
  return (
    <View sx={styles.row}>
      <View sx={styles.tile}>
        <Text>One</Text>
      </View>
      <View sx={[styles.tile, styles.second]}>
        <Text>Two</Text>
      </View>
      <View sx={[styles.tile, styles.third]}>
        <Text>Three</Text>
      </View>
    </View>
  );
}
