/**
 * Just enough Markdown for the repository's own docs (README.md and the
 * generated COMPATIBILITY.md): headings, paragraphs, fenced code, bullet
 * lists and pipe tables, plus `code`, **bold** and [links](url) inline.
 * Anything else renders as plain text.
 */

export type Block =
  | Readonly<{ type: "heading"; depth: number; text: string; id: string }>
  | Readonly<{ type: "paragraph"; text: string }>
  | Readonly<{ type: "code"; lang: string; code: string }>
  | Readonly<{ type: "list"; items: readonly string[] }>
  | Readonly<{ type: "table"; head: readonly string[]; rows: readonly (readonly string[])[] }>;

export type Inline =
  | Readonly<{ type: "text"; text: string }>
  | Readonly<{ type: "code"; text: string }>
  | Readonly<{ type: "strong"; text: string }>
  | Readonly<{ type: "link"; text: string; href: string }>;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inCode = false;
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] as string;
    if (ch === "\\" && body[i + 1] === "|") {
      cell += "|";
      i += 1;
    } else if (ch === "`") {
      inCode = !inCode;
      cell += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

const isSeparatorRow = (line: string) => /^\|?[\s:|-]+\|?$/.test(line.trim());
const isListItem = (line: string) => /^[-*] /.test(line);
const startsBlock = (line: string) =>
  line.startsWith("```") ||
  line.startsWith("#") ||
  line.startsWith("|") ||
  line.startsWith("<!--") ||
  isListItem(line);

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  const ids = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (line.trim() === "") {
      i += 1;
    } else if (line.startsWith("<!--")) {
      while (i < lines.length && !(lines[i] as string).includes("-->")) i += 1;
      i += 1;
    } else if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] as string).startsWith("```")) {
        code.push(lines[i] as string);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", lang, code: code.join("\n") });
    } else if (/^#{1,6} /.test(line)) {
      const depth = line.indexOf(" ");
      const text = line.slice(depth + 1).trim();
      const base = slugify(text);
      const seen = ids.get(base) ?? 0;
      ids.set(base, seen + 1);
      blocks.push({ type: "heading", depth, text, id: seen ? `${base}-${seen + 1}` : base });
      i += 1;
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] as string).startsWith("|")) {
        if (!(rows.length === 1 && isSeparatorRow(lines[i] as string))) {
          rows.push(splitRow(lines[i] as string));
        }
        i += 1;
      }
      blocks.push({ type: "table", head: rows[0] ?? [], rows: rows.slice(1) });
    } else if (isListItem(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i] as string;
        if (isListItem(current)) items.push(current.slice(2).trim());
        else if (/^\s+\S/.test(current) && items.length) {
          items[items.length - 1] += ` ${current.trim()}`;
        } else break;
        i += 1;
      }
      blocks.push({ type: "list", items });
    } else {
      const text: string[] = [];
      while (
        i < lines.length &&
        (lines[i] as string).trim() !== "" &&
        !startsBlock(lines[i] as string)
      ) {
        text.push((lines[i] as string).trim());
        i += 1;
      }
      blocks.push({ type: "paragraph", text: text.join(" ") });
    }
  }
  return blocks;
}

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "code", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "strong", text: m[2] });
    else out.push({ type: "link", text: m[3] as string, href: m[4] as string });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/**
 * The code blocks between a heading and the next heading of the same or a
 * higher level, in order. Throws when the heading is missing, so a renamed
 * README section fails the build instead of silently dropping a snippet.
 */
export function codeUnder(
  blocks: readonly Block[],
  heading: string,
): Readonly<{ lang: string; code: string }>[] {
  const start = blocks.findIndex((b) => b.type === "heading" && b.text === heading);
  const head = blocks[start];
  if (!head || head.type !== "heading") throw new Error(`docs-site: no "${heading}" heading`);
  const code: { lang: string; code: string }[] = [];
  for (const block of blocks.slice(start + 1)) {
    if (block.type === "heading" && block.depth <= head.depth) break;
    if (block.type === "code") code.push({ lang: block.lang, code: block.code });
  }
  return code;
}
