// Building blocks for the docs pages. Server components: layout comes from
// stylexn's View and Text, prose from semantic HTML styled with StyleX
// through the `stylexn` entry, so the site's own rules pass the same Layer 1
// checks as shared code; CSS-only declarations sit in `stylex.web({ })`.
import * as stylex from "stylexn";
import Link from "next/link";
import type { ReactNode } from "react";
import { Text, View } from "stylexn/elements";
import { highlight } from "../_lib/highlight";
import { colors, fonts, radii, space } from "./tokens.stylex";

const styles = stylex.create({
  header: {
    gap: space.md,
    marginBottom: space.sm,
  },
  h1: {
    fontSize: 34,
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: "-0.01em",
    color: colors.text,
  },
  lead: {
    maxWidth: "66ch",
    fontSize: 18,
    lineHeight: 1.6,
    color: colors.muted,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
    paddingTop: space.xxl,
    ...stylex.web({ scrollMarginTop: 72 }),
  },
  h2: {
    fontSize: 24,
    lineHeight: 1.3,
    fontWeight: 700,
    color: colors.text,
  },
  h2Standalone: {
    paddingTop: space.xxl,
    ...stylex.web({ scrollMarginTop: 72 }),
  },
  h3: {
    fontSize: 18,
    lineHeight: 1.4,
    fontWeight: 650,
    color: colors.text,
    paddingTop: space.sm,
    ...stylex.web({ scrollMarginTop: 72 }),
  },
  p: {
    maxWidth: "72ch",
    fontSize: 16,
    lineHeight: 1.7,
    color: colors.text,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: "0.88em",
    paddingBlock: 1,
    paddingInline: 5,
    borderRadius: 5,
    backgroundColor: colors.codeBg,
    color: colors.codeText,
    ...stylex.web({ overflowWrap: "anywhere" }),
  },
  link: {
    color: colors.accent,
    textDecorationLine: { default: "underline", ":hover": "none" },
    ...stylex.web({ textUnderlineOffset: 3 }),
    borderRadius: 3,
    outlineOffset: 2,
    outlineWidth: 2,
    outlineColor: colors.focus,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
  },
  ul: {
    maxWidth: "72ch",
    paddingLeft: space.xl,
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
    fontSize: 16,
    lineHeight: 1.7,
    color: colors.text,
  },
  figure: {
    display: "flex",
    flexDirection: "column",
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    overflow: "hidden",
    minWidth: 0,
  },
  figcaption: {
    paddingBlock: space.xs,
    paddingInline: space.md,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
  },
  pre: {
    margin: 0,
    padding: space.lg,
    ...stylex.web({ overflow: "auto" }),
    maxHeight: 560,
    fontFamily: fonts.mono,
    fontSize: 13.5,
    lineHeight: 1.6,
    tabSize: 2,
    color: colors.codeText,
    backgroundColor: colors.codeBg,
  },
  note: {
    gap: space.xs,
    maxWidth: "72ch",
    paddingBlock: space.md,
    paddingInline: space.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    color: colors.text,
    fontSize: 15,
    lineHeight: 1.6,
  },
  noteTitle: {
    fontWeight: 700,
  },
  toc: {
    gap: space.xs,
    paddingBlock: space.md,
    paddingInline: space.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
  },
  tocTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: colors.muted,
  },
  tocList: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: space.lg,
    rowGap: space.xs,
    ...stylex.web({ listStyle: "none" }),
    fontSize: 15,
  },
  tableWrap: {
    ...stylex.web({ overflowX: "auto" }),
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
  },
  table: {
    width: "100%",
    ...stylex.web({ borderCollapse: "collapse" }),
    fontSize: 14,
    lineHeight: 1.5,
    color: colors.text,
  },
  th: {
    textAlign: "left",
    verticalAlign: "bottom",
    paddingBlock: space.sm,
    paddingInline: space.md,
    fontWeight: 650,
    ...stylex.web({ whiteSpace: "nowrap" }),
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
  },
  td: {
    verticalAlign: "top",
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: colors.border,
  },
});

const tokenStyles = stylex.create({
  plain: {},
  comment: { color: colors.codeComment, fontStyle: "italic" },
  string: { color: colors.codeString },
  keyword: { color: colors.codeKeyword },
  number: { color: colors.codeNumber },
  tag: { color: colors.codeTag },
});

export function PageHeader({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <View sx={styles.header}>
      <h1 id="top" {...stylex.props(styles.h1)}>
        {title}
      </h1>
      {lead ? <p {...stylex.props(styles.lead)}>{lead}</p> : null}
    </View>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} {...stylex.props(styles.section)}>
      <h2 id={id} {...stylex.props(styles.h2)}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A section heading outside a <Section>, e.g. in rendered Markdown. */
export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} {...stylex.props(styles.h2, styles.h2Standalone)}>
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} {...stylex.props(styles.h3)}>
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p {...stylex.props(styles.p)}>{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code {...stylex.props(styles.code)}>{children}</code>;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  if (/^https?:/.test(href)) {
    return (
      <a href={href} {...stylex.props(styles.link)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...stylex.props(styles.link)}>
      {children}
    </Link>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul {...stylex.props(styles.ul)}>{children}</ul>;
}

export function Note({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View role="note" sx={styles.note}>
      {title ? <Text sx={styles.noteTitle}>{title}</Text> : null}
      <Text>{children}</Text>
    </View>
  );
}

/** A highlighted code listing, optionally captioned with its file name. */
export function CodeBlock({
  code,
  lang = "tsx",
  caption,
}: {
  code: string;
  lang?: string;
  caption?: string;
}) {
  return (
    <figure {...stylex.props(styles.figure)}>
      {caption ? <figcaption {...stylex.props(styles.figcaption)}>{caption}</figcaption> : null}
      <pre {...stylex.props(styles.pre)}>
        <code>
          {highlight(code.replace(/\n$/, ""), lang).map((token, i) =>
            token.kind === "plain" ? (
              token.text
            ) : (
              <span key={i} {...stylex.props(tokenStyles[token.kind])}>
                {token.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
}

export function OnThisPage({
  sections,
}: {
  sections: readonly (readonly [id: string, title: string])[];
}) {
  return (
    <View role="navigation" aria-label="On this page" sx={styles.toc}>
      <Text sx={styles.tocTitle}>On this page</Text>
      <ul {...stylex.props(styles.tocList)}>
        {sections.map(([id, title]) => (
          <li key={id}>
            <a href={`#${id}`} {...stylex.props(styles.link)}>
              {title}
            </a>
          </li>
        ))}
      </ul>
    </View>
  );
}

export function Table({
  head,
  rows,
}: {
  head: readonly ReactNode[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <div {...stylex.props(styles.tableWrap)}>
      <table {...stylex.props(styles.table)}>
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i} scope="col" {...stylex.props(styles.th)}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} {...stylex.props(styles.td)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
