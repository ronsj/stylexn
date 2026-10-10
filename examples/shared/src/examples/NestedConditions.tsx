"use client";

import * as stylex from "stylexn";
import { Pressable, Text } from "stylexn/elements";

const styles = stylex.create({
  button: {
    paddingBlock: 12,
    paddingInline: 20,
    borderRadius: 10,
    // Conditions nest: the dark scheme has its own resting, hover and
    // pressed colours instead of reusing the light ones.
    backgroundColor: {
      default: "#ede7f8",
      ":hover": "#dccff3",
      ":active": "#c9b8ec",
      "@media (prefers-color-scheme: dark)": {
        default: "#2e2640",
        ":hover": "#3d3256",
        ":active": "#4a3d68",
      },
    },
    color: {
      default: "#3d2a66",
      "@media (prefers-color-scheme: dark)": "#e6dcff",
    },
  },
  label: {
    fontSize: 15,
    fontWeight: 600,
  },
});

export function NestedConditions() {
  return (
    <Pressable sx={styles.button}>
      <Text sx={styles.label}>Hover and press me in light and dark mode</Text>
    </Pressable>
  );
}
