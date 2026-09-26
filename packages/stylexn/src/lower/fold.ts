/**
 * Constant folding for `calc()`, `min()`, `max()` and `clamp()`. Operands
 * may be bare numbers, absolute lengths (px, pt, cm, ...), percentages,
 * parentheses and nested math functions. Relative units (em, rem, vw),
 * `var()` and mixing percentages with lengths cannot be folded, because
 * React Native has no expression values: the caller reports and drops them.
 */
import { ABSOLUTE_UNITS } from "./units.ts";

type Kind = "number" | "px" | "%";
type Quantity = { kind: Kind; value: number };

export type Folded = Readonly<{ ok: true; kind: Kind; value: number }>;
export type FoldError = Readonly<{ ok: false; reason: string }>;

const MATH = /^(calc|min|max|clamp)\(/i;

export const isMathFunction = (token: string): boolean => MATH.test(token.trim());

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
const UNIT = /^[a-z%]*/i;

class Parser {
  private readonly src: string;
  private pos = 0;

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
    const args: Quantity[] = [];
    if (!MATH.test(`${name}(`)) throw new Error(`${name}() is not static`);
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
    const kind = (args[0] as Quantity).kind;
    if (!args.every((a) => a.kind === kind)) throw new Error(`${name}() mixes units`);
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
      if (left.kind !== right.kind) {
        throw new Error(`cannot add ${describe(left)} and ${describe(right)}`);
      }
      left = {
        kind: left.kind,
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
        if (left.kind !== "number" && right.kind !== "number") {
          throw new Error(`cannot multiply ${describe(left)} by ${describe(right)}`);
        }
        left = {
          kind: left.kind === "number" ? right.kind : left.kind,
          value: left.value * right.value,
        };
      } else {
        if (right.kind !== "number") throw new Error(`cannot divide by ${describe(right)}`);
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
      const factor = ABSOLUTE_UNITS[unit];
      if (factor === undefined) throw new Error(`unit "${unit}" is not static`);
      return { kind: "px", value: value * factor };
    }
    if (/^[a-z-]+\(/i.test(rest)) return this.fn();
    throw new Error(`unexpected "${rest.slice(0, 12)}"`);
  }
}

const describe = (q: Quantity): string =>
  q.kind === "number" ? "a number" : q.kind === "px" ? "a length" : "a percentage";

/** Fold a single math-function token. `null` when the token is not one. */
export function foldMath(token: string): Folded | FoldError | null {
  const src = token.trim();
  if (!isMathFunction(src)) return null;
  try {
    const parser = new Parser(src);
    const q = parser.fn();
    parser.end();
    if (!Number.isFinite(q.value)) throw new Error("not a finite value");
    return { ok: true, kind: q.kind, value: Math.round(q.value * 1000) / 1000 };
  } catch (error) {
    return { ok: false, reason: `${src}: ${(error as Error).message}` };
  }
}

/** The folded value as a CSS token the rest of lowering understands. */
export function foldedToken(f: Folded): string {
  return f.kind === "number" ? String(f.value) : `${f.value}${f.kind}`;
}
