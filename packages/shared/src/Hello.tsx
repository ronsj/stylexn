"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { native, web } from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";
import { greeting } from "./greeting";
import { colors } from "./tokens.stylex";

// One file for both platforms: `stylexn` is StyleX on web and the StyleXN
// runtime on native; the elements render DOM or React Native primitives.

// CSS keyframes on web; an Animated loop on native.
const pulse = stylex.keyframes({
  from: { opacity: 1 },
  "50%": { opacity: 0.35 },
  to: { opacity: 1 },
});

const styles = stylex.create({
  root: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.accent,
    borderRadius: 12,
    // Escape hatches: a web-only rendering hint, and a native-only tweak
    // using a React Native-specific key.
    ...web({ willChange: "transform" }),
    ...native({ elevation: 2 }),
    width: {
      default: "100%",
      "@media (min-width: 800px)": 512,
    },
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 24,
    color: colors.accent,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    animationName: pulse,
    animationDuration: "1.6s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  button: {
    alignSelf: "flex-start",
    paddingBlock: 8,
    paddingInline: 16,
    borderRadius: 8,
    backgroundColor: {
      default: colors.accent,
      ":hover": "#7a4fb5",
      ":active": "#4b2a7a",
    },
    transform: {
      default: "scale(1)",
      ":active": "scale(0.96)",
    },
    // Transitions run through Animated on native.
    transitionProperty: "background-color, transform",
    transitionDuration: "150ms",
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
  },
});

export function Hello({ name }: { name: string }) {
  const [count, setCount] = useState(0);
  return (
    <View sx={styles.root}>
      <View sx={styles.titleRow}>
        <View sx={styles.dot} aria-label="live" />
        <Text sx={styles.title}>{greeting(name)}</Text>
      </View>
      <Pressable sx={styles.button} onPress={() => setCount((c) => c + 1)} testID="hello-button">
        <Text sx={styles.buttonText}>Pressed {count} times</Text>
      </Pressable>
    </View>
  );
}
