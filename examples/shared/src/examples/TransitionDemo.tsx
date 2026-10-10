"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";

const styles = stylex.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  track: {
    width: 64,
    height: 36,
    padding: 4,
    borderRadius: 18,
    backgroundColor: "#cfc8dc",
    transitionProperty: "background-color",
    transitionDuration: "200ms",
  },
  trackOn: {
    backgroundColor: "#6a3db8",
  },
  knob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
    transform: "translateX(0px)",
    transitionProperty: "transform",
    transitionDuration: "250ms",
    // Overshoots a little before settling.
    transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  knobOn: {
    transform: "translateX(28px)",
  },
  label: {
    width: 32,
    fontSize: 15,
    fontWeight: 600,
    color: { default: "#1f1b26", "@media (prefers-color-scheme: dark)": "#f3f0f8" },
  },
});

/** Changing the style starts the transition; no animation code needed. */
export function TransitionDemo() {
  const [on, setOn] = useState(false);
  return (
    <View sx={styles.row}>
      <Pressable
        sx={[styles.track, on && styles.trackOn]}
        role="switch"
        aria-checked={on}
        aria-label="Transition demo"
        onPress={() => setOn((value) => !value)}
      >
        <View sx={[styles.knob, on && styles.knobOn]} />
      </Pressable>
      <Text sx={styles.label}>{on ? "On" : "Off"}</Text>
    </View>
  );
}
