"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  box: {
    width: 300,
    maxWidth: "100%",
    padding: 16,
    gap: 8,
    borderRadius: 12,
    backgroundColor: { default: "#f1ebfb", [DARK]: "#282236" },
    // Text styles on a View reach every Text inside it, as CSS inherits
    // them. React Native alone would only inherit between nested Text.
    color: { default: "#3d2a66", [DARK]: "#e6dcff" },
    fontSize: 18,
    lineHeight: 1.4,
    textAlign: "center",
  },
  small: {
    // Relative to the inherited 18px.
    fontSize: "0.75em",
  },
  strong: {
    fontWeight: 700,
    color: { default: "#6a3db8", [DARK]: "#bda1f5" },
  },
});

export function TextInheritance() {
  return (
    <View sx={styles.box}>
      <Text>Colour, size, line height and alignment come from the View.</Text>
      <Text sx={styles.small}>This line is 0.75em of the inherited 18px.</Text>
      <Text>
        Nested <Text sx={styles.strong}>Text</Text> inherits too.
      </Text>
    </View>
  );
}
