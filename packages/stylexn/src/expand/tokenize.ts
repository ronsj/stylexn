/**
 * Split a CSS value on top-level separators, leaving function arguments and
 * quoted strings intact: `"10px rgb(0, 0, 0)"` -> `["10px", "rgb(0, 0, 0)"]`.
 */
function splitTopLevel(value: string, isSeparator: (ch: string) => boolean): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] as string;
    if (quote) {
      current += ch;
      if (ch === "\\" && i + 1 < value.length) current += value[++i];
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (depth === 0 && isSeparator(ch)) {
      if (current.trim()) out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function splitSpace(value: string): string[] {
  return splitTopLevel(value, (ch) => ch === " " || ch === "\t" || ch === "\n");
}

export function splitComma(value: string): string[] {
  return splitTopLevel(value, (ch) => ch === ",");
}

/** Split `"1px / 2px"` style slash-separated groups at the top level. */
export function splitSlash(value: string): string[] {
  return splitTopLevel(value, (ch) => ch === "/").map((s) => s.trim());
}

const TIME = /^-?\d*\.?\d+(ms|s)$/i;
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const LENGTH = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?([a-z]+|%)?$/i;
const IDENT = /^-?[_a-z][\w-]*$/i;
const FUNCTION = /^[-\w]+\(.*\)$/s;

export const isTime = (t: string): boolean => TIME.test(t);
export const isNumber = (t: string): boolean => NUMBER.test(t);
/** Number with an optional unit or percentage (includes plain numbers). */
export const isLength = (t: string): boolean => LENGTH.test(t);
export const isIdent = (t: string): boolean => IDENT.test(t);
export const isFunction = (t: string): boolean => FUNCTION.test(t);

const COLOR_FUNCTIONS = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "light-dark",
]);

/** Heuristic: hex, color function, or an identifier that is not a known keyword class. */
export function looksLikeColor(t: string): boolean {
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return true;
  const fn = t.match(/^([-\w]+)\(/)?.[1]?.toLowerCase();
  if (fn) return COLOR_FUNCTIONS.has(fn);
  return isIdent(t) && !isLength(t);
}
