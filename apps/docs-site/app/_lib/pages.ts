/** The docs pages in reading order; the navigation and the pager follow it. */
export const PAGES = [
  { href: "/", title: "Introduction" },
  { href: "/getting-started/", title: "Getting started" },
  { href: "/styles/", title: "Authoring styles" },
] as const;

export type Page = (typeof PAGES)[number];

/** `usePathname()` may or may not carry the trailing slash; compare without it. */
export const samePath = (a: string, b: string) => a.replace(/\/$/, "") === b.replace(/\/$/, "");
