"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { native, web } from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";
import { greeting } from "./greeting";
import { colors } from "./tokens.stylex";

// One file for both platforms: `stylexn` is StyleX on web and the StyleXN
// runtime on native; the elements render DOM or React Native primitives.
const styles = stylex.create({
  root: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.accent,
    borderRadius: 12,
    // Escape hatches: web-only styles StyleXN has no native answer for yet,
    // and a native-only tweak using a React Native-specific key.
    ...web({ transitionProperty: "border-color", transitionDuration: "150ms" }),
    ...native({ elevation: 2 }),
    width: {
      default: "100%",
      "@media (min-width: 800px)": 512,
    },
  },
  title: {
    fontSize: 24,
    color: colors.accent,
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
      <Text sx={styles.title}>{greeting(name)}</Text>
      <Pressable sx={styles.button} onPress={() => setCount((c) => c + 1)} testID="hello-button">
        <Text sx={styles.buttonText}>Pressed {count} times</Text>
      </Pressable>
    </View>
  );
}
