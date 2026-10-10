"use client";

import * as stylex from "stylexn";
import { Image, Text, View } from "stylexn/elements";
// A `{ src }` object under Next, a URL string under Vite, a number under Metro.
import sunset from "./assets/sunset.png";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  card: {
    width: 280,
    maxWidth: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: { default: "#ffffff", [DARK]: "#26222e" },
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.18)",
  },
  // The image covers its box by default, like React Native's resizeMode "cover".
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  caption: {
    padding: 12,
    fontSize: 14,
    color: { default: "#5b5566", [DARK]: "#b9b2c6" },
  },
});

export function ImageCard() {
  return (
    <View sx={styles.card}>
      <Image sx={styles.image} src={sunset} alt="A sunset over purple hills" />
      <Text sx={styles.caption}>A PNG imported from the package, cropped to 16:9.</Text>
    </View>
  );
}
