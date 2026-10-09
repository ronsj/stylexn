"use client";

import * as stylex from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";
import { cardMarker } from "./cardMarker.stylex";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  card: {
    width: 280,
    maxWidth: "100%",
    padding: 20,
    gap: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: { default: "#e4dff0", [DARK]: "#3a3346" },
    backgroundColor: { default: "#ffffff", [DARK]: "#26222e" },
  },
  // The text reads the card's state, not its own: the whole card is the target.
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: {
      default: "#1f1b26",
      [DARK]: "#f3f0f8",
      [stylex.when.ancestor(":hover", cardMarker)]: "#8b5fd6",
      [stylex.when.ancestor(":active", cardMarker)]: "#e0457b",
    },
  },
  body: {
    fontSize: 14,
    lineHeight: 1.5,
    color: { default: "#5b5566", [DARK]: "#b9b2c6" },
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  arrow: {
    fontSize: 18,
    color: "#8b5fd6",
    transform: {
      default: "translateX(0px)",
      [stylex.when.ancestor(":hover", cardMarker)]: "translateX(4px)",
      [stylex.when.ancestor(":active", cardMarker)]: "translateX(8px)",
    },
    transitionProperty: "transform",
    transitionDuration: "150ms",
    transitionTimingFunction: "ease-out",
  },
});

/** The card carries a marker; the title and arrow inside follow its hover and press. */
export function AncestorPress() {
  return (
    <Pressable sx={[cardMarker, styles.card]} onPress={() => {}}>
      <Text sx={styles.title}>Press the card</Text>
      <Text sx={styles.body}>
        The title and the arrow change with the card&apos;s state, wherever you press it.
      </Text>
      <View sx={styles.row}>
        <Text sx={styles.body}>Read more</Text>
        <Text sx={styles.arrow}>→</Text>
      </View>
    </Pressable>
  );
}
