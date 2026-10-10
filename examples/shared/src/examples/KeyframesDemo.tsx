"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

// CSS keyframes on the web; an Animated loop on native.
const bounce = stylex.keyframes({
  "0%, 80%, 100%": { transform: "scale(0.5)", opacity: 0.4 },
  "40%": { transform: "scale(1)", opacity: 1 },
});

const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const REDUCED = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 32,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#6a3db8",
    animationName: bounce,
    animationDuration: "1.2s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
    animationPlayState: { default: "running", [REDUCED]: "paused" },
  },
  second: { animationDelay: "0.15s" },
  third: { animationDelay: "0.3s" },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 4,
    borderStyle: "solid",
    borderColor: "#e3dbf3",
    borderTopColor: "#6a3db8",
    animationName: spin,
    animationDuration: "0.9s",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear",
    animationPlayState: { default: "running", [REDUCED]: "paused" },
  },
  note: {
    flexShrink: 1,
    maxWidth: 200,
    fontSize: 13,
    color: { default: "#5b5566", "@media (prefers-color-scheme: dark)": "#b9b2c6" },
  },
});

export function KeyframesDemo() {
  return (
    <View sx={styles.row}>
      <View sx={styles.dots} role="progressbar" aria-label="Loading">
        <View sx={styles.dot} />
        <View sx={[styles.dot, styles.second]} />
        <View sx={[styles.dot, styles.third]} />
      </View>
      <View sx={styles.spinner} role="progressbar" aria-label="Loading" />
      <Text sx={styles.note}>Both pause when the system asks for reduced motion.</Text>
    </View>
  );
}
