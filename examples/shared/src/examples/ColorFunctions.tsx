"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

// Modern colour functions work on native too: the Babel plugin converts
// them to rgb() at build time (light-dark() becomes a colour-scheme condition).
const styles = stylex.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    maxWidth: 360,
  },
  swatch: {
    width: 104,
    height: 64,
    padding: 8,
    justifyContent: "flex-end",
    borderRadius: 10,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 600,
  },
  oklch: { backgroundColor: "oklch(55% 0.2 300)" },
  lab: { backgroundColor: "lab(50% 45 -55)" },
  mix: { backgroundColor: "color-mix(in oklch, #6a3db8 60%, #f0a531)" },
  p3: { backgroundColor: "color(display-p3 0.2 0.55 0.45)" },
  hsl: { backgroundColor: "hsl(200 70% 42%)" },
  lightDark: {
    backgroundColor: "light-dark(#3d2a66, #bda1f5)",
    color: "light-dark(#fff, #1f1b26)",
  },
});

export function ColorFunctions() {
  return (
    <View sx={styles.grid}>
      <View sx={[styles.swatch, styles.oklch]}>
        <Text>oklch()</Text>
      </View>
      <View sx={[styles.swatch, styles.lab]}>
        <Text>lab()</Text>
      </View>
      <View sx={[styles.swatch, styles.mix]}>
        <Text>color-mix()</Text>
      </View>
      <View sx={[styles.swatch, styles.p3]}>
        <Text>color(display-p3)</Text>
      </View>
      <View sx={[styles.swatch, styles.hsl]}>
        <Text>hsl()</Text>
      </View>
      <View sx={[styles.swatch, styles.lightDark]}>
        <Text>light-dark()</Text>
      </View>
    </View>
  );
}
