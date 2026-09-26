"use client";

import * as stylex from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";
import { buttonColors } from "./buttonTheme.stylex";

// New values for the same variables. Passed in `sx`, a theme applies to the
// element it is on: its own styles read the overridden values.
const green = stylex.createTheme(buttonColors, {
  background: "#1f7a4d",
  pressed: "#155c39",
});

const coral = stylex.createTheme(buttonColors, {
  background: "#b8432d",
  pressed: "#8f3322",
});

const styles = stylex.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  button: {
    paddingBlock: 10,
    paddingInline: 16,
    borderRadius: 8,
    backgroundColor: { default: buttonColors.background, ":active": buttonColors.pressed },
    // Set on the button, so the resolved colour cascades to the Text.
    color: buttonColors.text,
    fontSize: 15,
    fontWeight: 600,
  },
});

export function ThemeDemo() {
  return (
    <View sx={styles.row}>
      <Pressable sx={styles.button}>
        <Text>Default</Text>
      </Pressable>
      <Pressable sx={[green, styles.button]}>
        <Text>Green theme</Text>
      </Pressable>
      <Pressable sx={[coral, styles.button]}>
        <Text>Coral theme</Text>
      </Pressable>
    </View>
  );
}
