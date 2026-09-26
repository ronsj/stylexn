"use client";

import type { ReactNode } from "react";
import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const styles = stylex.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingBlock: 4,
    paddingInline: 10,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    color: "#3d2a66",
    backgroundColor: "#ebe3fa",
  },
  // Variants only override what differs; later styles win.
  success: {
    color: "#0f5132",
    backgroundColor: "#d1f0dd",
  },
  warning: {
    color: "#664d03",
    backgroundColor: "#fff1c2",
  },
  large: {
    paddingBlock: 6,
    paddingInline: 14,
    fontSize: 15,
  },
});

type Tone = "neutral" | "success" | "warning";

function Badge({
  tone = "neutral",
  large = false,
  children,
}: {
  tone?: Tone;
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <Text
      sx={[
        styles.badge,
        tone === "success" && styles.success,
        tone === "warning" && styles.warning,
        large && styles.large,
      ]}
    >
      {children}
    </Text>
  );
}

export function BadgeVariants() {
  return (
    <View sx={styles.row}>
      <Badge>Draft</Badge>
      <Badge tone="success">Published</Badge>
      <Badge tone="warning">Needs review</Badge>
      <Badge tone="success" large>
        Large
      </Badge>
    </View>
  );
}
