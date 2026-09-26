import { splitComma, splitSpace } from "../expand/tokenize.ts";
import { parseLength } from "../lower/units.ts";
import type { Env } from "./types.ts";

/**
 * Evaluate a `@media` condition against the runtime environment. Supports
 * media types, `not`/`only`/`and`, comma-separated alternatives, boolean and
 * `name: value` features, and range syntax (`(400px <= width < 800px)`).
 * Unknown features evaluate to false.
 */
export function matchesMedia(query: string, env: Env): boolean {
  const body = query.replace(/^@media\s*/i, "").trim();
  if (body === "") return true;
  return splitComma(body).some((q) => matchesQuery(q.trim(), env));
}

function matchesQuery(query: string, env: Env): boolean {
  let negate = false;
  let rest = query;
  if (/^not\s/i.test(rest)) {
    negate = true;
    rest = rest.slice(4);
  } else if (/^only\s/i.test(rest)) {
    rest = rest.slice(5);
  }
  const parts = splitAnd(rest.trim());
  let result = true;
  for (const part of parts) {
    if (part.startsWith("(")) {
      result = result && matchesFeature(part.slice(1, -1).trim(), env);
    } else {
      result = result && matchesType(part.toLowerCase());
    }
    if (!result) break;
  }
  return negate ? !result : result;
}

/** Split on top-level ` and `, keeping parenthesised groups intact. */
function splitAnd(query: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  const lower = query.toLowerCase();
  for (let i = 0; i < query.length; i++) {
    const ch = query[i] as string;
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && lower.startsWith(" and ", i)) {
      out.push(current.trim());
      current = "";
      i += 4;
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function matchesType(type: string): boolean {
  return type === "all" || type === "screen";
}

const RANGE = /^(.+?)\s*(<=|>=|<|>|=)\s*(.+?)(?:\s*(<=|<|>=|>)\s*(.+))?$/;

function matchesFeature(feature: string, env: Env): boolean {
  const colon = feature.indexOf(":");
  if (colon !== -1) {
    const name = feature.slice(0, colon).trim().toLowerCase();
    const value = feature
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    return matchesNamed(name, value, env);
  }
  const range = feature.match(RANGE);
  if (range) return matchesRange(range, env);
  return matchesBoolean(feature.trim().toLowerCase(), env);
}

function matchesNamed(name: string, value: string, env: Env): boolean {
  const m = name.match(/^(min|max)-(.+)$/);
  if (m) {
    const actual = numeric(m[2] as string, env);
    const expected = parseValue(m[2] as string, value, env);
    if (actual === null || expected === null) return false;
    return m[1] === "min" ? actual >= expected : actual <= expected;
  }
  switch (name) {
    case "orientation":
      return (env.window.width >= env.window.height ? "landscape" : "portrait") === value;
    case "prefers-color-scheme":
      return env.colorScheme === value;
    case "prefers-reduced-motion":
      return value === "reduce" ? env.reducedMotion : !env.reducedMotion;
    case "hover":
    case "any-hover":
      return value === "hover" ? env.pointer === "fine" : env.pointer !== "fine";
    case "pointer":
    case "any-pointer":
      return value === env.pointer;
    default: {
      const actual = numeric(name, env);
      const expected = parseValue(name, value, env);
      if (actual === null || expected === null) return false;
      return actual === expected;
    }
  }
}

function matchesBoolean(name: string, env: Env): boolean {
  switch (name) {
    case "hover":
    case "any-hover":
      return env.pointer === "fine";
    case "pointer":
    case "any-pointer":
      return env.pointer !== "none";
    default: {
      const actual = numeric(name, env);
      return actual !== null && actual !== 0;
    }
  }
}

function matchesRange(m: RegExpMatchArray, env: Env): boolean {
  const [, a, op1, b, op2, c] = m as unknown as [string, string, string, string, string?, string?];
  // Forms: `name op value`, `value op name`, `value op name op value`.
  if (op2 && c !== undefined) {
    const name = b.trim().toLowerCase();
    const actual = numeric(name, env);
    const lo = parseValue(name, a.trim(), env);
    const hi = parseValue(name, c.trim(), env);
    if (actual === null || lo === null || hi === null) return false;
    return compare(lo, flip(op1), actual) && compare(actual, op2, hi);
  }
  const leftIsName = numeric(a.trim().toLowerCase(), env) !== null;
  const name = (leftIsName ? a : b).trim().toLowerCase();
  const actual = numeric(name, env);
  const expected = parseValue(name, (leftIsName ? b : a).trim(), env);
  if (actual === null || expected === null) return false;
  return leftIsName ? compare(actual, op1, expected) : compare(expected, op1, actual);
}

/** `a op b` with `a` on the left as written: `lo <= actual` means actual >= lo. */
function flip(op: string): string {
  return op === "<" ? "<" : op === "<=" ? "<=" : op === ">" ? ">" : op === ">=" ? ">=" : "=";
}

function compare(left: number, op: string, right: number): boolean {
  switch (op) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    default:
      return left === right;
  }
}

/** Current value of a numeric feature, or null when unknown. */
function numeric(name: string, env: Env): number | null {
  switch (name) {
    case "width":
      return env.window.width;
    case "height":
      return env.window.height;
    case "aspect-ratio":
      return env.window.width / env.window.height;
    case "resolution":
      return env.window.scale;
    default:
      return null;
  }
}

/** Parse a feature value into the same units as `numeric()`. */
function parseValue(name: string, value: string, env: Env): number | null {
  if (name === "aspect-ratio") {
    const [w, h = "1"] = splitSpace(value.replace(/\s*\/\s*/, "/"))
      .join("")
      .split("/");
    const ratio = Number(w) / Number(h);
    return Number.isFinite(ratio) ? ratio : null;
  }
  const parsed = parseLength(value);
  if (!parsed) return null;
  if (name === "resolution") {
    if (parsed.unit === "dppx" || parsed.unit === "x" || parsed.unit === "") return parsed.value;
    if (parsed.unit === "dpi") return parsed.value / 96;
    return null;
  }
  switch (parsed.unit) {
    case "":
    case "px":
      return parsed.value;
    case "em":
    case "rem":
      return parsed.value * env.rootFontSize;
    default:
      return null;
  }
}
