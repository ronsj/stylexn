/**
 * Length handling for the lowering step. React Native lengths are unitless
 * density-independent numbers that correspond 1:1 to CSS px, so every
 * absolute CSS unit converts at compile time. Relative units (rem, em, v*)
 * depend on runtime context and are left as strings for the runtime.
 */

/** CSS px per unit for context-free units. */
export const ABSOLUTE_UNITS: Readonly<Record<string, number>> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
};

export const RELATIVE_UNITS: ReadonlySet<string> = new Set([
  "rem",
  "em",
  "vw",
  "vh",
  "vmin",
  "vmax",
  "dvw",
  "dvh",
  "svw",
  "svh",
  "lvw",
  "lvh",
]);

const LENGTH = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

export type Length = Readonly<{ value: number; unit: string }>;

/** Parse a single length/number/percentage token; `unit` is "" for bare numbers. */
export function parseLength(token: string): Length | null {
  const m = token.trim().match(LENGTH);
  if (!m) return null;
  return { value: Number(m[1]), unit: (m[2] ?? "").toLowerCase() };
}

/**
 * Convert one token to a React Native number when its unit is absolute.
 * Returns null for percentages, relative units, keywords and non-lengths.
 */
export function toNumber(token: string): number | null {
  const parsed = parseLength(token);
  if (!parsed) return null;
  if (parsed.unit === "") return parsed.value;
  const factor = ABSOLUTE_UNITS[parsed.unit];
  if (factor === undefined) return null;
  return round(parsed.value * factor);
}

/** Convert `turn`/`grad` angles to `deg` inside a transform string. */
export function normalizeAngles(transform: string): string {
  return transform
    .replace(/(-?\d*\.?\d+)turn\b/gi, (_, n: string) => `${round(Number(n) * 360)}deg`)
    .replace(/(-?\d*\.?\d+)grad\b/gi, (_, n: string) => `${round(Number(n) * 0.9)}deg`);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
