import type { RNLeaf } from "../lower/lower.ts";

/**
 * Text properties that CSS inherits but React Native does not cascade from
 * a View to nested Text. The elements move them off the View and into
 * context; Text merges them under its own style (see elements/native.ts).
 */
export const INHERITED_TEXT_KEYS: ReadonlySet<string> = new Set([
  "color",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textTransform",
  "textShadowColor",
  "textShadowOffset",
  "textShadowRadius",
  "writingDirection",
]);

export type InheritedTextStyle = Readonly<Record<string, RNLeaf>>;

/**
 * Inherited values that differ from the rendered style, by style object
 * (see `Resolved.inherit`): a unitless `lineHeight` renders as a number but
 * cascades as the multiplier. Registered by `useProps`, read by
 * `splitInherited`, so the hook's result shape stays `{ style, ...props }`.
 */
const inheritOverrides = new WeakMap<object, InheritedTextStyle>();

export function registerInherit(style: object, overrides: InheritedTextStyle): void {
  inheritOverrides.set(style, overrides);
}

/** Split a resolved style into the element's own keys and the ones its text descendants inherit. */
export function splitInherited<V = RNLeaf>(
  style: Readonly<Record<string, V>>,
): {
  own: Readonly<Record<string, V>>;
  inherited: Readonly<Record<string, V>>;
} {
  let any = false;
  for (const key in style) {
    if (INHERITED_TEXT_KEYS.has(key)) {
      any = true;
      break;
    }
  }
  // Nothing to inherit (most Views): the style is its own, no copies.
  if (!any) return { own: style, inherited: EMPTY as Readonly<Record<string, V>> };
  const own: Record<string, V> = {};
  const inherited: Record<string, V> = {};
  for (const [key, value] of Object.entries(style)) {
    if (INHERITED_TEXT_KEYS.has(key)) inherited[key] = value;
    else own[key] = value;
  }
  const overrides = inheritOverrides.get(style);
  if (overrides) Object.assign(inherited, overrides);
  return { own, inherited };
}
const EMPTY: Readonly<Record<string, never>> = Object.freeze({});

const UNITLESS_NUMBER = /^-?\d*\.?\d+$/;

/**
 * The style a Text renders: inherited values under its own (the cascade).
 * An inherited unitless `lineHeight` is a multiplier of this element's font
 * size, like CSS; `fallbackFontSize` applies when nothing sets one.
 */
export function mergeInherited(
  inherited: InheritedTextStyle,
  own: Readonly<Record<string, RNLeaf>>,
  fallbackFontSize: number,
): Record<string, RNLeaf> {
  const merged: Record<string, RNLeaf> = { ...inherited, ...own };
  const lineHeight = merged.lineHeight;
  if (typeof lineHeight === "string" && UNITLESS_NUMBER.test(lineHeight)) {
    const fontSize = typeof merged.fontSize === "number" ? merged.fontSize : fallbackFontSize;
    merged.lineHeight = Number(lineHeight) * fontSize;
  }
  return merged;
}

export function shallowEqual(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}
