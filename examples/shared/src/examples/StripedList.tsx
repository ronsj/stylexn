"use client";

import * as stylex from "stylexn";
import { Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const ROWS = [
  ["padding", "supported"],
  [":hover", "polyfilled"],
  ["display", "partial"],
  ["willChange", "web-only"],
  [":nth-child", "unsupported"],
] as const;

type Status = (typeof ROWS)[number][1];

const styles = stylex.create({
  list: {
    width: 300,
    maxWidth: "100%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: "#e3dbf3", [DARK]: "#3a3445" },
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBlock: 10,
    paddingInline: 14,
    fontSize: 15,
    backgroundColor: { default: "#ffffff", [DARK]: "#26222e" },
    color: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  },
  // Not `:nth-child(even)`, which React Native cannot evaluate: the index,
  // which the component already has, picks the style.
  striped: {
    backgroundColor: { default: "#f6f3fb", [DARK]: "#2e2838" },
  },
  status: {
    fontSize: 13,
    fontWeight: 600,
  },
  supported: { color: { default: "#1d6b3a", [DARK]: "#8fd6a4" } },
  polyfilled: { color: { default: "#6a3db8", [DARK]: "#bda1f5" } },
  partial: { color: { default: "#8a5a00", [DARK]: "#f4c26b" } },
  webOnly: { color: { default: "#1f5aa6", [DARK]: "#8fbcf5" } },
  unsupported: { color: { default: "#b3261e", [DARK]: "#ff8a80" } },
});

const statusStyle = {
  supported: styles.supported,
  polyfilled: styles.polyfilled,
  partial: styles.partial,
  "web-only": styles.webOnly,
  unsupported: styles.unsupported,
} satisfies Record<Status, unknown>;

export function StripedList() {
  return (
    <View sx={styles.list} role="list">
      {ROWS.map(([name, status], index) => (
        <View key={name} sx={[styles.row, index % 2 === 1 && styles.striped]} role="listitem">
          <Text>{name}</Text>
          <Text sx={[styles.status, statusStyle[status]]}>{status}</Text>
        </View>
      ))}
    </View>
  );
}
