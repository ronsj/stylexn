"use client";

import * as stylex from "stylexn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Pressable, Text, View } from "stylexn/elements";
import { PAGES, samePath } from "../_lib/pages";
import { colors, fonts, radii, space } from "./tokens.stylex";

const WIDE = "@media (min-width: 900px)";

const styles = stylex.create({
  nav: {
    ...stylex.web({ position: "sticky" }),
    top: 0,
    zIndex: 1,
    width: { default: "100%", [WIDE]: 260 },
    height: { default: "auto", [WIDE]: "100vh" },
    ...stylex.web({ overflowY: { default: "visible", [WIDE]: "auto" } }),
    padding: space.lg,
    gap: space.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderBottomWidth: { default: 1, [WIDE]: 0 },
    borderRightWidth: { default: 0, [WIDE]: 1 },
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.text,
    textDecoration: "none",
    borderRadius: radii.sm,
    outlineOffset: 2,
    outlineWidth: 2,
    outlineColor: colors.focus,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
  },
  tag: {
    marginLeft: space.sm,
    paddingBlock: space.xxs,
    paddingInline: space.sm,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    verticalAlign: "middle",
  },
  toggle: {
    display: { default: "flex", [WIDE]: "none" },
    paddingBlock: space.xs,
    paddingInline: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: { default: colors.page, ":hover": colors.accentSoft },
    fontSize: 14,
    outlineOffset: 2,
    outlineWidth: 2,
    outlineColor: colors.focus,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: space.xxs,
    ...stylex.web({ listStyle: "none" }),
  },
  // Narrow screens: the list is hidden until the menu is opened.
  closed: {
    display: { default: "none", [WIDE]: "flex" },
  },
  link: {
    ...stylex.web({ display: "block" }),
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderRadius: radii.sm,
    fontFamily: fonts.body,
    fontSize: 15,
    color: { default: colors.muted, ":hover": colors.text },
    backgroundColor: { default: "transparent", ":hover": colors.page },
    textDecoration: "none",
    outlineOffset: -2,
    outlineWidth: 2,
    outlineColor: colors.focus,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
  },
  active: {
    color: { default: colors.accent, ":hover": colors.accent },
    backgroundColor: { default: colors.accentSoft, ":hover": colors.accentSoft },
    fontWeight: 600,
  },
});

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <View role="navigation" aria-label="Documentation" sx={styles.nav}>
      <View sx={styles.bar}>
        <Link href="/" {...stylex.props(styles.brand)}>
          StyleXN<span {...stylex.props(styles.tag)}>docs</span>
        </Link>
        <Pressable sx={styles.toggle} aria-expanded={open} onPress={() => setOpen((o) => !o)}>
          <Text>{open ? "Close" : "Menu"}</Text>
        </Pressable>
      </View>
      <ul {...stylex.props(styles.list, !open && styles.closed)}>
        {PAGES.map((page) => {
          const current = samePath(pathname, page.href);
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
                {...stylex.props(styles.link, current && styles.active)}
              >
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </View>
  );
}
