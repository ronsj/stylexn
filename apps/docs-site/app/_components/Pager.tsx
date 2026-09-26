"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Text, View } from "stylexn/elements";
import { PAGES, samePath } from "../_lib/pages";
import { colors, radii, space } from "./tokens.stylex";

const styles = stylex.create({
  pager: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.lg,
    marginTop: space.xxxl,
    paddingTop: space.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  link: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxs,
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderRadius: radii.sm,
    textDecoration: "none",
    color: colors.accent,
    backgroundColor: { default: "transparent", ":hover": colors.accentSoft },
    outlineOffset: 2,
    outlineWidth: 2,
    outlineColor: colors.focus,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
  },
  next: {
    alignItems: "flex-end",
    marginLeft: "auto",
  },
  label: {
    fontSize: 13,
    color: colors.muted,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
  },
});

/** Previous and next page, in the order of the navigation. */
export function Pager() {
  const pathname = usePathname();
  const index = PAGES.findIndex((page) => samePath(pathname, page.href));
  if (index === -1) return null;
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  return (
    <View role="navigation" aria-label="Previous and next page" sx={styles.pager}>
      {prev ? (
        <Link href={prev.href} rel="prev" {...stylex.props(styles.link)}>
          <Text sx={styles.label}>Previous</Text>
          <Text sx={styles.title}>{prev.title}</Text>
        </Link>
      ) : null}
      {next ? (
        <Link href={next.href} rel="next" {...stylex.props(styles.link, styles.next)}>
          <Text sx={styles.label}>Next</Text>
          <Text sx={styles.title}>{next.title}</Text>
        </Link>
      ) : null}
    </View>
  );
}
