"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  stack: {
    alignItems: "center",
    gap: 10,
  },
  button: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 60,
    backgroundColor: { default: "#6a3db8", ":hover": "#7d52c9" },
    color: "#ffffff",
    transform: { default: "scale(1)", ":active": "scale(0.94)" },
    transitionProperty: "transform",
    transitionDuration: "120ms",
  },
  count: {
    fontSize: 36,
    fontWeight: 700,
  },
  hint: {
    fontSize: 12,
  },
  status: {
    fontSize: 14,
    color: { default: "#5b5566", [DARK]: "#b9b2c6" },
  },
});

export function PressableCounter() {
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Press, or hold to reset");
  return (
    <View sx={styles.stack}>
      <Pressable
        sx={styles.button}
        onPress={() => setCount((c) => c + 1)}
        onPressIn={() => setStatus("Pressing…")}
        onPressOut={() => setStatus("Press, or hold to reset")}
        onLongPress={() => {
          setCount(0);
          setStatus("Reset by a long press");
        }}
        aria-label={`Count ${count}. Press to add one, hold to reset.`}
      >
        <Text sx={styles.count}>{count}</Text>
        <Text sx={styles.hint}>tap</Text>
      </Pressable>
      <Text sx={styles.status}>{status}</Text>
    </View>
  );
}
