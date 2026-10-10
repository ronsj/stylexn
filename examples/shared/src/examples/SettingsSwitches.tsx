"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { Switch, Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  panel: {
    width: 280,
    maxWidth: "100%",
    borderRadius: 12,
    backgroundColor: { default: "#ffffff", [DARK]: "#26222e" },
    color: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBlock: 12,
    paddingInline: 14,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: { default: "#ece8f2", [DARK]: "#3a3445" },
  },
  // sx sizes and places the control; its colours are the platform's own.
  switch: {
    marginLeft: 12,
  },
  muted: {
    color: { default: "#8c8599", [DARK]: "#8d8a9c" },
  },
});

export function SettingsSwitches() {
  const [notifications, setNotifications] = useState(true);
  const [digest, setDigest] = useState(false);
  return (
    <View sx={styles.panel}>
      <View sx={styles.row}>
        <Text>Notifications</Text>
        <Switch
          sx={styles.switch}
          value={notifications}
          onValueChange={setNotifications}
          aria-label="Notifications"
        />
      </View>
      <View sx={styles.divider} />
      <View sx={[styles.row, !notifications && styles.muted]}>
        <Text>Weekly digest</Text>
        <Switch
          sx={styles.switch}
          value={digest && notifications}
          onValueChange={setDigest}
          disabled={!notifications}
          aria-label="Weekly digest"
        />
      </View>
    </View>
  );
}
