"use client";

import type { ReactNode } from "react";
import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

// The card from the stylexn README, with a text colour so it reads in both
// colour schemes (the colour cascades to the Text inside, on native too).
const styles = stylex.create({
  card: {
    padding: 16,
    borderRadius: 12,
    width: { default: "100%", "@media (min-width: 800px)": 512 },
    maxWidth: "100%",
    backgroundColor: { default: "white", "@media (prefers-color-scheme: dark)": "#1c1c1e" },
    color: { default: "#1c1c1e", "@media (prefers-color-scheme: dark)": "#f2f2f7" },
    transitionProperty: "transform",
    transitionDuration: "150ms",
    transform: { default: "scale(1)", ":active": "scale(0.97)" },
  },
});

export function Card({ children }: { children: ReactNode }) {
  return <View sx={styles.card}>{children}</View>;
}

export function FirstCard() {
  return (
    <Card>
      <Text>Press and hold me. Resize the window past 800px to change my width.</Text>
    </Card>
  );
}
