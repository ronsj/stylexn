/**
 * The `lh` unit on React Native. React Native exposes no line-height
 * metrics, so `lh` is resolved at compile time against the same rule's
 * static `lineHeight`: an absolute line height gives a px length, a unitless,
 * percentage or em line height an em length (which the runtime resolves
 * against the element's font size, like any em). Anything else (a
 * conditional, a variable, rem, `normal`, no lineHeight at all) cannot be
 * resolved. `rlh` (the root's line height) stays unsupported.
 */
import { isSentinel } from "../sentinel.ts";
import type { Value } from "../expand/types.ts";
import { isConditional } from "../expand/types.ts";
import { parseLength, toNumber } from "./units.ts";

/** One line height: a px length or a multiple of the element's font size. */
export type LineHeightBasis = Readonly<{ unit: "px" | "em"; value: number }>;

/** `<number>lh` tokens; `rlh` and identifiers containing `lh` do not match. */
const LH_TOKEN = /(?<![\w.-])([+-]?(?:\d+\.?\d*|\.\d+))lh\b/gi;
const HAS_LH = /(?<![\w.-])[+-]?(?:\d+\.?\d*|\.\d+)lh\b/i;

export const LH_NEEDS_LINE_HEIGHT = "`lh` needs a static lineHeight in the same rule";
export const LH_IN_LINE_HEIGHT =
  "`lh` in lineHeight refers to the parent's line height, which is not known on React Native";

export const containsLh = (value: string): boolean => HAS_LH.test(value);

/** The rule's line height as an `lh` basis, or null when it is not static. */
export function lineHeightBasis(lineHeight: Value | undefined): LineHeightBasis | null {
  if (lineHeight === undefined || lineHeight === null || isConditional(lineHeight)) return null;
  if (typeof lineHeight === "number") return { unit: "em", value: lineHeight };
  if (isSentinel(lineHeight)) return null;
  const parsed = parseLength(lineHeight);
  if (!parsed) return null;
  if (parsed.unit === "") return { unit: "em", value: parsed.value };
  if (parsed.unit === "%") return { unit: "em", value: parsed.value / 100 };
  if (parsed.unit === "em") return { unit: "em", value: parsed.value };
  const px = toNumber(lineHeight);
  return px === null ? null : { unit: "px", value: px };
}

const round = (n: number): number => Math.round(n * 10000) / 10000;

/** Rewrite every `<n>lh` token (plain or inside `calc()`) to px or em. */
export function rewriteLh(value: string, basis: LineHeightBasis): string {
  return value.replace(
    LH_TOKEN,
    (_, n: string) => `${round(Number(n) * basis.value)}${basis.unit}`,
  );
}
