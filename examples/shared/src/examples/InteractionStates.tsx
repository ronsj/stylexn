"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { Pressable, Text, TextInput, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  stack: {
    width: 280,
    maxWidth: "100%",
    gap: 12,
  },
  button: {
    alignItems: "center",
    paddingBlock: 10,
    paddingInline: 16,
    borderRadius: 8,
    backgroundColor: {
      default: "#6a3db8",
      ":hover": "#7d52c9",
      ":active": "#4f2c8c",
      ":disabled": "#b9b2c6",
    },
    // A focus ring for keyboard users; on native :focus-visible is :focus.
    outlineColor: "#f0a531",
    outlineOffset: 2,
    outlineWidth: { default: 0, ":focus-visible": 3 },
    outlineStyle: "solid",
  },
  label: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 600,
  },
  input: {
    paddingBlock: 8,
    paddingInline: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: { default: "#d6d0e2", ":hover": "#b9b2c6", ":focus": "#6a3db8" },
    backgroundColor: { default: "#ffffff", [DARK]: "#1f1c26" },
    color: { default: "#1f1b26", [DARK]: "#f3f0f8", "::placeholder": "#8c8599" },
    fontSize: 15,
  },
});

export function InteractionStates() {
  const [count, setCount] = useState(0);
  return (
    <View sx={styles.stack}>
      <Pressable sx={styles.button} onPress={() => setCount((c) => c + 1)}>
        <Text sx={styles.label}>Hover, press, tab to me ({count})</Text>
      </Pressable>
      <Pressable sx={styles.button} disabled>
        <Text sx={styles.label}>Disabled</Text>
      </Pressable>
      <TextInput sx={styles.input} placeholder="Focus me" aria-label="Focus me" />
    </View>
  );
}
