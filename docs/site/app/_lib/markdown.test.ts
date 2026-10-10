import { expect, test } from "vitest";
import { codeUnder, parseInline, parseMarkdown } from "./markdown";
import { readRepoFile } from "./repo";

test("parses headings, paragraphs, code, lists and tables", () => {
  const blocks = parseMarkdown(
    [
      "# Title",
      "<!-- generated -->",
      "Some `code` and",
      "a **bold** word.",
      "",
      "```ts",
      'import "x";',
      "```",
      "",
      "- one",
      "  continued",
      "- two",
      "",
      "| A | B |",
      "| - | - |",
      "| `a\\|b` | c |",
      "## Title",
    ].join("\n"),
  );
  expect(blocks).toEqual([
    { type: "heading", depth: 1, text: "Title", id: "title" },
    { type: "paragraph", text: "Some `code` and a **bold** word." },
    { type: "code", lang: "ts", code: 'import "x";' },
    { type: "list", items: ["one continued", "two"] },
    { type: "table", head: ["A", "B"], rows: [["`a|b`", "c"]] },
    { type: "heading", depth: 2, text: "Title", id: "title-2" },
  ]);
});

test("parses inline code, bold and links", () => {
  expect(parseInline("see `a` and **b** in [the docs](./X.md).")).toEqual([
    { type: "text", text: "see " },
    { type: "code", text: "a" },
    { type: "text", text: " and " },
    { type: "strong", text: "b" },
    { type: "text", text: " in " },
    { type: "link", text: "the docs", href: "./X.md" },
    { type: "text", text: "." },
  ]);
});

test("the README still has the snippets the Getting started page shows", () => {
  const readme = parseMarkdown(readRepoFile("stylexn/stylexn/README.md"));
  expect(codeUnder(readme, "Install")[0]?.code).toContain("pnpm add stylexn");
  expect(codeUnder(readme, "React Native (Expo / Metro)").map((b) => b.lang)).toEqual(["js", "js"]);
  expect(codeUnder(readme, "Web (Next.js or any StyleX setup)")[1]?.code).toBe(
    'import "stylexn/elements.css";',
  );
  expect(() => codeUnder(readme, "No such heading")).toThrow();
});

test("COMPATIBILITY.md parses into its sections and tables", () => {
  const blocks = parseMarkdown(readRepoFile("stylexn/stylexn/COMPATIBILITY.md"));
  const h2 = blocks.flatMap((b) => (b.type === "heading" && b.depth === 2 ? [b.text] : []));
  expect(h2).toEqual(
    expect.arrayContaining(["Statuses", "Summary", "Properties", "Units", "StyleX API"]),
  );
  const rows = blocks.flatMap((b) => (b.type === "table" ? b.rows : []));
  expect(rows.find((row) => row[0] === "`display`")?.[1]).toBe("partial");
});
