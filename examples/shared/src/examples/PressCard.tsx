"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { Pressable, Text } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  card: {
    width: 280,
    maxWidth: "100%",
    padding: 20,
    gap: 6,
    borderRadius: 16,
    backgroundColor: { default: "#ffffff", [DARK]: "#26222e" },
    boxShadow: {
      default: "0 1px 3px rgba(0, 0, 0, 0.14)",
      ":hover": "0 10px 24px rgba(80, 40, 140, 0.22)",
    },
    // One transform list for every state, so the parts interpolate.
    transform: {
      default: "translateY(0px) scale(1)",
      ":hover": "translateY(-3px) scale(1)",
      ":active": "translateY(0px) scale(0.97)",
    },
    transitionProperty: "transform",
    transitionDuration: "180ms",
    transitionTimingFunction: "ease-out",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  },
  body: {
    fontSize: 14,
    lineHeight: 1.5,
    color: { default: "#5b5566", [DARK]: "#b9b2c6" },
  },
  liked: {
    color: { default: "#c2185b", [DARK]: "#ff7aa8" },
  },
});

/** A card that lifts on hover and sinks while pressed; pressing toggles a like. */
export function PressCard() {
  const [liked, setLiked] = useState(false);
  return (
    <Pressable sx={styles.card} onPress={() => setLiked((l) => !l)}>
      <Text sx={styles.title}>One file, two platforms</Text>
      <Text sx={styles.body}>
        Hover to lift me, press to push me down. The same styles run as CSS here and through the
        StyleXN runtime in React Native.
      </Text>
      <Text sx={[styles.body, liked && styles.liked]}>{liked ? "♥ Liked" : "♡ Tap to like"}</Text>
    </Pressable>
  );
}
