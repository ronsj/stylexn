"use client";

import { useRef, useState } from "react";
import * as stylex from "stylexn";
import { Pressable, ScrollView, Text, View } from "stylexn/elements";
import type { ScrollViewHandle } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const TOPICS = [
  "Layout",
  "Conditions",
  "Units",
  "Colours",
  "Variables",
  "Themes",
  "Transitions",
  "Keyframes",
  "Elements",
  "Checks",
];

const styles = stylex.create({
  stack: {
    width: 300,
    maxWidth: "100%",
    gap: 10,
  },
  scroller: {
    borderRadius: 10,
  },
  // contentSx styles the row inside the scroll container.
  content: {
    gap: 8,
    paddingBlock: 4,
  },
  chip: {
    paddingBlock: 6,
    paddingInline: 12,
    borderRadius: 999,
    backgroundColor: { default: "#ebe3fa", [DARK]: "#2e2640" },
    color: { default: "#3d2a66", [DARK]: "#e6dcff" },
    fontSize: 14,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  button: {
    paddingBlock: 6,
    paddingInline: 12,
    borderRadius: 8,
    backgroundColor: { default: "#6a3db8", ":hover": "#7d52c9" },
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
  },
  offset: {
    fontSize: 13,
    color: { default: "#5b5566", [DARK]: "#b9b2c6" },
  },
});

export function ChipScroller() {
  const scroller = useRef<ScrollViewHandle>(null);
  const [x, setX] = useState(0);
  return (
    <View sx={styles.stack}>
      <ScrollView
        ref={scroller}
        horizontal
        sx={styles.scroller}
        contentSx={styles.content}
        onScroll={(event) => setX(Math.round(event.x))}
        role="list"
      >
        {TOPICS.map((topic) => (
          <Text key={topic} sx={styles.chip} role="listitem">
            {topic}
          </Text>
        ))}
      </ScrollView>
      <View sx={styles.controls}>
        <Pressable sx={styles.button} onPress={() => scroller.current?.scrollTo({ x: 0 })}>
          <Text>Start</Text>
        </Pressable>
        <Pressable sx={styles.button} onPress={() => scroller.current?.scrollToEnd()}>
          <Text>End</Text>
        </Pressable>
        <Text sx={styles.offset}>x: {x}</Text>
      </View>
    </View>
  );
}
