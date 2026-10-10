import type { ReactNode } from "react";
import { parseInline, type Block } from "../_lib/markdown";
import { A, Code, CodeBlock, H2, H3, P, Table, Ul } from "./ui";

/** Files the repository's Markdown links to that have a page here. */
const PAGE_FOR: Readonly<Record<string, string>> = {
  "./COMPATIBILITY.md": "/compatibility/",
  "COMPATIBILITY.md": "/compatibility/",
};

export function InlineMarkdown({ text }: { text: string }): ReactNode {
  return parseInline(text).map((part, i) => {
    switch (part.type) {
      case "code":
        return <Code key={i}>{part.text}</Code>;
      case "strong":
        return <strong key={i}>{part.text}</strong>;
      case "link": {
        const href = PAGE_FOR[part.href] ?? part.href;
        return href.startsWith("/") || href.startsWith("http") ? (
          <A key={i} href={href}>
            {part.text}
          </A>
        ) : (
          part.text
        );
      }
      default:
        return part.text;
    }
  });
}

/** Renders parsed Markdown; a level-1 heading is left to the page header. */
export function Markdown({ blocks }: { blocks: readonly Block[] }) {
  return blocks.map((block, i) => {
    switch (block.type) {
      case "heading":
        if (block.depth === 1) return null;
        return block.depth === 2 ? (
          <H2 key={i} id={block.id}>
            <InlineMarkdown text={block.text} />
          </H2>
        ) : (
          <H3 key={i} id={block.id}>
            <InlineMarkdown text={block.text} />
          </H3>
        );
      case "paragraph":
        return (
          <P key={i}>
            <InlineMarkdown text={block.text} />
          </P>
        );
      case "code":
        return <CodeBlock key={i} code={block.code} lang={block.lang} />;
      case "list":
        return (
          <Ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineMarkdown text={item} />
              </li>
            ))}
          </Ul>
        );
      case "table":
        return (
          <Table
            key={i}
            head={block.head.map((cell, j) => (
              <InlineMarkdown key={j} text={cell} />
            ))}
            rows={block.rows.map((row) =>
              row.map((cell, j) => <InlineMarkdown key={j} text={cell} />),
            )}
          />
        );
    }
  });
}
