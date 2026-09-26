"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  card: {
    width: 300,
    maxWidth: "100%",
    gap: 10,
    color: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#6a3db8",
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    // Text in a row does not shrink by default, on either platform: allow
    // it, so a long title wraps instead of overflowing.
    flexShrink: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 1.5,
  },
  em: { fontStyle: "italic" },
  strong: { fontWeight: 700 },
  underline: {
    textDecorationLine: "underline",
    textDecorationColor: "#6a3db8",
  },
});

export function TextBasics() {
  return (
    <View sx={styles.card}>
      <View sx={styles.row}>
        <View sx={styles.icon} />
        <Text sx={styles.title}>A long title that wraps onto a second line</Text>
      </View>
      <Text sx={styles.body}>
        Text nests: <Text sx={styles.strong}>bold</Text>, <Text sx={styles.em}>italic</Text> and{" "}
        <Text sx={styles.underline}>underlined</Text> spans keep the paragraph&apos;s size and line
        height.
      </Text>
    </View>
  );
}
