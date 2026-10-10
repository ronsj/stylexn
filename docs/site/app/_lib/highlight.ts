/**
 * A small syntax highlighter for the code on this site (TS/TSX/JS, JSON,
 * YAML, shell), run at build time. It only knows comments, strings,
 * keywords, numbers and JSX tags; everything else, and all of "text"
 * (tool output), is plain.
 */

export type TokenKind = "plain" | "comment" | "string" | "keyword" | "number" | "tag";
export type Token = Readonly<{ kind: TokenKind; text: string }>;

const KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "const",
  "default",
  "else",
  "export",
  "extends",
  "false",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "interface",
  "keyof",
  "let",
  "new",
  "null",
  "of",
  "readonly",
  "return",
  "switch",
  "this",
  "true",
  "type",
  "typeof",
  "undefined",
  "var",
  "while",
]);

const SCRIPT = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "json"]);

type Rule = Readonly<{ kind: TokenKind; re: RegExp }>;

const STRING = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/y;
const NUMBER = /-?\b\d+(?:\.\d+)?\b/y;
const WORD = /[A-Za-z_$][\w$]*/y;
const JSX_TAG = /<\/?[A-Za-z][\w.:-]*/y;

function rulesFor(lang: string): readonly Rule[] {
  if (SCRIPT.has(lang)) {
    return [
      { kind: "comment", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
      { kind: "string", re: STRING },
      { kind: "number", re: NUMBER },
    ];
  }
  // yaml, sh, and anything else: hash comments and quoted strings.
  return [
    { kind: "comment", re: /(?<![^\s])#[^\n]*/y },
    { kind: "string", re: /"(?:\\.|[^"\\\n])*"|'[^'\n]*'/y },
  ];
}

export function highlight(code: string, lang: string): Token[] {
  if (lang === "text") return [{ kind: "plain", text: code }];
  const rules = rulesFor(lang);
  const script = SCRIPT.has(lang);
  const tokens: Token[] = [];
  let plain = "";
  const push = (kind: TokenKind, text: string) => {
    if (plain) tokens.push({ kind: "plain", text: plain });
    plain = "";
    tokens.push({ kind, text });
  };
  let i = 0;
  scan: while (i < code.length) {
    for (const { kind, re } of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m?.[0]) {
        push(kind, m[0]);
        i += m[0].length;
        continue scan;
      }
    }
    if (script) {
      // A `<` after an identifier or `)` is a comparison or a type argument,
      // not JSX.
      if (code[i] === "<" && !/[\w$)\]]/.test(code[i - 1] ?? "")) {
        JSX_TAG.lastIndex = i;
        const m = JSX_TAG.exec(code);
        if (m) {
          push("tag", m[0]);
          i += m[0].length;
          continue;
        }
      }
      WORD.lastIndex = i;
      const word = WORD.exec(code);
      if (word) {
        if (KEYWORDS.has(word[0])) push("keyword", word[0]);
        else plain += word[0];
        i += word[0].length;
        continue;
      }
    }
    plain += code[i];
    i += 1;
  }
  if (plain) tokens.push({ kind: "plain", text: plain });
  return tokens;
}
