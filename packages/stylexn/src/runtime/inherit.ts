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

/** Split a resolved style into the element's own keys and the ones its text descendants inherit. */
export function splitInherited(style: Readonly<Record<string, RNLeaf>>): {
  own: Record<string, RNLeaf>;
  inherited: Record<string, RNLeaf>;
} {
  const own: Record<string, RNLeaf> = {};
  const inherited: Record<string, RNLeaf> = {};
  for (const [key, value] of Object.entries(style)) {
    if (INHERITED_TEXT_KEYS.has(key)) inherited[key] = value;
    else own[key] = value;
  }
  return { own, inherited };
}

export function shallowEqual(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}
