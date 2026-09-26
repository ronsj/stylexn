"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  card: {
    // Grows with the window between two limits.
    width: "clamp(220px, 30vw, 340px)",
    maxWidth: "100%",
    padding: "1.25rem",
    gap: "0.75rem",
    borderRadius: "0.75rem",
    backgroundColor: { default: "#ffffff", [DARK]: "#26222e" },
    color: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: 700,
  },
  tag: {
    alignSelf: "flex-start",
    fontSize: 13,
    // em is relative to this element's own font size: 0.75em of 13px.
    paddingBlock: "0.25em",
    paddingInline: "0.75em",
    borderRadius: "1em",
    color: "#ffffff",
    backgroundColor: "#6a3db8",
  },
  bar: {
    // Mixes a relative and an absolute length; resolved once rem is known.
    height: "calc(0.5rem + 2px)",
    width: "12rem",
    maxWidth: "100%",
    borderRadius: 999,
    backgroundColor: "#a987e6",
  },
});

export function UnitsDemo() {
  return (
    <View sx={styles.card}>
      <Text sx={styles.title}>Sized in rem, em and vw</Text>
      <Text sx={styles.tag}>0.75em padding</Text>
      <View sx={styles.bar} />
      <Text>Resize the window: my width is clamp(220px, 30vw, 340px).</Text>
    </View>
  );
}
