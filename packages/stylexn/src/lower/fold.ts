/**
 * Constant folding for `calc()`, `min()`, `max()` and `clamp()`. Operands
 * may be bare numbers, absolute lengths (px, pt, cm, ...), percentages,
 * angles, parentheses and nested math functions. Relative units (em, rem,
 * vw, ...) and `var()` are only known at runtime: the expression is kept
 * and the runtime folds it (see runtime/resolve.ts). Mixing percentages
 * with lengths cannot be expressed on React Native and is an error.
 */
import { splitComma, splitSpace } from "../expand/tokenize.ts";
import { ABSOLUTE_UNITS, RELATIVE_UNITS } from "./units.ts";

type Kind = "number" | "px" | "%" | "deg" | "unknown";
type Quantity = { kind: Kind; value: number };

export type Folded = Readonly<{ ok: true; kind: Exclude<Kind, "unknown">; value: number }>;
export type FoldError = Readonly<{ ok: false; reason: string }>;
/** Static as far as units go, but needs runtime context (relative units, var()). */
export type FoldDeferred = Readonly<{ ok: "runtime" }>;
export type FoldResult = Folded | FoldError | FoldDeferred;

const MATH = /^(calc|min|max|clamp)\(/i;
/** Whether a math function appears anywhere in a value (also nested). */
export const MATH_ANYWHERE = /\b(calc|min|max|clamp)\(/i;

export const isMathFunction = (token: string): boolean => MATH.test(token.trim());

const ANGLE_UNITS: Readonly<Record<string, number>> = {
  deg: 1,
  rad: 180 / Math.PI,
  turn: 360,
  grad: 0.9,
};

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
const UNIT = /^[a-z%]*/i;

/** Kinds must agree, except `unknown` (var()) which takes the other side. */
function unify(a: Kind, b: Kind, what: string): Kind {
  if (a === "unknown") return b;
  if (b === "unknown") return a;
  if (a !== b) throw new Error(`cannot ${what} ${describe(a)} and ${describe(b)}`);
  return a;
}

class Parser {
  private readonly src: string;
  private pos = 0;
  deferred = false;

  constructor(src: string) {
    this.src = src;
  }

  private skip(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos] as string)) this.pos++;
  }

  private peek(): string {
    this.skip();
    return this.src[this.pos] ?? "";
  }

  private eat(ch: string): void {
    if (this.peek() !== ch) throw new Error(`expected "${ch}" in "${this.src}"`);
    this.pos++;
  }

  end(): void {
    if (this.peek() !== "") throw new Error(`unexpected "${this.src.slice(this.pos)}"`);
  }

  /** `name(args)` at the current position. */
  fn(): Quantity {
    const m = this.src.slice(this.pos).match(/^\s*([a-z-]+)\(/i);
    if (!m) throw new Error(`expected a function in "${this.src}"`);
    const name = (m[1] as string).toLowerCase();
    this.pos += m[0].length;
    if (name === "var") {
      // Resolved at runtime; skip to the matching paren.
      let depth = 1;
      while (this.pos < this.src.length && depth > 0) {
        const ch = this.src[this.pos++];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      if (depth !== 0) throw new Error("unterminated var()");
      this.deferred = true;
      return { kind: "unknown", value: NaN };
    }
    if (!MATH.test(`${name}(`)) throw new Error(`${name}() is not static`);
    const args: Quantity[] = [];
    for (;;) {
      args.push(this.expr());
      if (this.peek() === ",") {
        this.pos++;
        continue;
      }
      this.eat(")");
      break;
    }
    if (name === "calc") {
      if (args.length !== 1) throw new Error("calc() takes one expression");
      return args[0] as Quantity;
    }
    if (name === "clamp" && args.length !== 3) throw new Error("clamp() takes three values");
    let kind: Kind = "unknown";
    for (const a of args) {
      if (kind !== "unknown" && a.kind !== "unknown" && a.kind !== kind) {
        throw new Error(`${name}() mixes units`);
      }
      if (a.kind !== "unknown") kind = a.kind;
    }
    const values = args.map((a) => a.value);
    if (name === "min") return { kind, value: Math.min(...values) };
    if (name === "max") return { kind, value: Math.max(...values) };
    const [lo, mid, hi] = values as [number, number, number];
    return { kind, value: Math.max(lo, Math.min(mid, hi)) };
  }

  private expr(): Quantity {
    let left = this.term();
    for (;;) {
      const op = this.peek();
      if (op !== "+" && op !== "-") return left;
      this.pos++;
      const right = this.term();
      left = {
        kind: unify(left.kind, right.kind, "add"),
        value: op === "+" ? left.value + right.value : left.value - right.value,
      };
    }
  }

  private term(): Quantity {
    let left = this.factor();
    for (;;) {
      const op = this.peek();
      if (op !== "*" && op !== "/") return left;
      this.pos++;
      const right = this.factor();
      if (op === "*") {
        const numberSide = left.kind === "number" || left.kind === "unknown";
        const otherNumber = right.kind === "number" || right.kind === "unknown";
        if (!numberSide && !otherNumber) {
          throw new Error(`cannot multiply ${describe(left.kind)} by ${describe(right.kind)}`);
        }
        left = {
          kind:
            left.kind === "number" ? right.kind : left.kind === "unknown" ? right.kind : left.kind,
          value: left.value * right.value,
        };
      } else {
        if (right.kind !== "number" && right.kind !== "unknown") {
          throw new Error(`cannot divide by ${describe(right.kind)}`);
        }
        if (right.value === 0) throw new Error("division by zero");
        left = { kind: left.kind, value: left.value / right.value };
      }
    }
  }

  private factor(): Quantity {
    const ch = this.peek();
    if (ch === "(") {
      this.pos++;
      const inner = this.expr();
      this.eat(")");
      return inner;
    }
    const rest = this.src.slice(this.pos);
    const num = rest.match(NUMBER);
    if (num) {
      this.pos += num[0].length;
      const unit = (this.src.slice(this.pos).match(UNIT)?.[0] ?? "").toLowerCase();
      this.pos += unit.length;
      const value = Number(num[0]);
      if (unit === "") return { kind: "number", value };
      if (unit === "%") return { kind: "%", value };
      const px = ABSOLUTE_UNITS[unit];
      if (px !== undefined) return { kind: "px", value: value * px };
      const deg = ANGLE_UNITS[unit];
      if (deg !== undefined) return { kind: "deg", value: value * deg };
      if (RELATIVE_UNITS.has(unit)) {
        this.deferred = true;
        return { kind: "px", value: NaN };
      }
      throw new Error(`unit "${unit}" is not supported`);
    }
    if (/^[a-z-]+\(/i.test(rest)) return this.fn();
    throw new Error(`unexpected "${rest.slice(0, 12)}"`);
  }
}

const describe = (k: Kind): string =>
  k === "number"
    ? "a number"
    : k === "px"
      ? "a length"
      : k === "%"
        ? "a percentage"
        : k === "deg"
          ? "an angle"
          : "a variable";

/** Fold a single math-function token. `null` when the token is not one. */
export function foldMath(token: string): FoldResult | null {
  const src = token.trim();
  if (!isMathFunction(src)) return null;
  try {
    const parser = new Parser(src);
    const q = parser.fn();
    parser.end();
    if (parser.deferred) return { ok: "runtime" };
    if (!Number.isFinite(q.value)) throw new Error("not a finite value");
    if (q.kind === "unknown") return { ok: "runtime" };
    return { ok: true, kind: q.kind, value: Math.round(q.value * 1000) / 1000 };
  } catch (error) {
    return { ok: false, reason: `${src}: ${(error as Error).message}` };
  }
}

/** The folded value as a CSS token the rest of lowering understands. */
export function foldedToken(f: Folded): string {
  return f.kind === "number" ? String(f.value) : `${f.value}${f.kind}`;
}

/**
 * Rewrite function tokens anywhere in a value, including inside other
 * functions' arguments (`translateX(calc(...))`, gradient colors). `map`
 * returns a replacement, `undefined` to leave a token alone (its arguments
 * are still visited), or `null` to abort; the result is then null.
 */
export function mapFunctions(
  value: string,
  map: (token: string) => string | null | undefined,
): string | null {
  const out: string[] = [];
  for (const token of splitSpace(value)) {
    const mapped = map(token);
    if (mapped === null) return null;
    if (mapped !== undefined) {
      out.push(mapped);
      continue;
    }
    const open = token.indexOf("(");
    if (open === -1 || !token.endsWith(")")) {
      out.push(token);
      continue;
    }
    const original = splitComma(token.slice(open + 1, -1));
    const args: string[] = [];
    for (const arg of original) {
      const inner = mapFunctions(arg, map);
      if (inner === null) return null;
      args.push(inner);
    }
    // Keep the author's spacing unless something inside actually changed.
    const changed = args.some((a, i) => a !== original[i]);
    out.push(changed ? `${token.slice(0, open)}(${args.join(", ")})` : token);
  }
  return out.join(" ");
}
