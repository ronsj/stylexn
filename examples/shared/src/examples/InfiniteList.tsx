"use client";

import { useState } from "react";
import * as stylex from "stylexn";
import { FlatList, Text, View } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";
const PAGE = 15;
const LIMIT = 60;

type Row = Readonly<{ id: number; title: string }>;

const page = (from: number): Row[] =>
  Array.from({ length: PAGE }, (_, i) => ({ id: from + i, title: `Message ${from + i + 1}` }));

const styles = stylex.create({
  list: {
    width: 280,
    maxWidth: "100%",
    // A bounded height, so the list scrolls inside the example.
    height: 240,
    flexGrow: 0,
    borderRadius: 12,
    backgroundColor: { default: "#ffffff", [DARK]: "#26222e" },
    color: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  },
  header: {
    paddingBlock: 10,
    paddingInline: 14,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6a3db8",
  },
  row: {
    paddingBlock: 10,
    paddingInline: 14,
    fontSize: 15,
  },
  separator: {
    height: 1,
    marginInline: 14,
    backgroundColor: { default: "#ece8f2", [DARK]: "#3a3445" },
  },
  footer: {
    padding: 14,
    fontSize: 13,
    color: { default: "#5b5566", [DARK]: "#b9b2c6" },
  },
});

/** Loads another page each time the end comes into view, up to 60 rows. */
export function InfiniteList() {
  const [rows, setRows] = useState(() => page(0));
  const done = rows.length >= LIMIT;
  return (
    <FlatList
      sx={styles.list}
      data={rows}
      keyExtractor={(row) => String(row.id)}
      renderItem={({ item }) => <Text sx={styles.row}>{item.title}</Text>}
      header={<Text sx={styles.header}>Inbox</Text>}
      separator={<View sx={styles.separator} />}
      footer={<Text sx={styles.footer}>{done ? `All ${LIMIT} loaded` : "Loading more…"}</Text>}
      onEndReached={() => {
        if (!done) setRows((current) => [...current, ...page(current.length)]);
      }}
      onEndReachedThreshold={0.5}
    />
  );
}
