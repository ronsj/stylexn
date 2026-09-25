/**
 * Leaf-level shorthand expanders. Each takes one non-null leaf value and
 * returns the complete set of longhands the CSS shorthand defines (omitted
 * parts get their CSS initial value), or a string explaining why the value
 * cannot be expanded. Longhand names are the ones in the compat table; some
 * are themselves shorthands and are expanded again by the caller.
 */
import type { Leaf } from "./types.ts";
import {
  isFunction,
  isIdent,
  isLength,
  isNumber,
  isTime,
  looksLikeColor,
  splitComma,
  splitSlash,
  splitSpace,
} from "./tokenize.ts";

export type LeafResult = Record<string, Leaf> | string;

type Expander = (value: Exclude<Leaf, null>) => LeafResult;

const tokens = (value: string | number): string[] =>
  typeof value === "number" ? [String(value)] : splitSpace(value);

// Numbers written as numbers stay numbers so unit handling downstream is unchanged.
const keep = (original: string | number, token: string): Leaf =>
  typeof original === "number" ? original : token;

/** 1–4 values in CSS box order: top, right, bottom, left. */
export function expandBox(
  value: string | number,
  [top, right, bottom, left]: readonly [string, string, string, string],
): LeafResult {
  const t = tokens(value);
  if (t.length < 1 || t.length > 4) return `expected 1 to 4 values, got ${t.length}`;
  const [a, b = a, c = a, d = b] = t as [string, string?, string?, string?];
  return {
    [top]: keep(value, a),
    [right]: keep(value, b),
    [bottom]: keep(value, c),
    [left]: keep(value, d),
  };
}

/** 1–2 values: start, end. */
export function expandPair(
  value: string | number,
  [start, end]: readonly [string, string],
): LeafResult {
  const t = tokens(value);
  if (t.length < 1 || t.length > 2) return `expected 1 or 2 values, got ${t.length}`;
  const [a, b = a] = t as [string, string?];
  return { [start]: keep(value, a), [end]: keep(value, b) };
}

/** 1–4 corner radii: top-left, top-right, bottom-right, bottom-left. No `/` syntax. */
export function expandCorners(
  value: string | number,
  [tl, tr, br, bl]: readonly [string, string, string, string],
): LeafResult {
  if (typeof value === "string" && splitSlash(value).length > 1) {
    return "elliptical radii (the `/` syntax) are not supported";
  }
  const t = tokens(value);
  if (t.length < 1 || t.length > 4) return `expected 1 to 4 values, got ${t.length}`;
  const [a, b = a, c = a, d = b] = t as [string, string?, string?, string?];
  return {
    [tl]: keep(value, a),
    [tr]: keep(value, b),
    [br]: keep(value, c),
    [bl]: keep(value, d),
  };
}

const BORDER_STYLES = new Set([
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
  "auto", // outline only
]);
const BORDER_WIDTH_KEYWORDS = new Set(["thin", "medium", "thick"]);

/** `<width> || <style> || <color>` in any order, e.g. border, outline. */
export function expandBorderLike(
  value: string | number,
  [width, style, color]: readonly [string, string, string],
): LeafResult {
  const t = tokens(value);
  if (t.length < 1 || t.length > 3) return `expected 1 to 3 values, got ${t.length}`;
  const out: Record<string, Leaf> = { [width]: "medium", [style]: "none", [color]: "currentcolor" };
  const seen = new Set<string>();
  for (const token of t) {
    const lower = token.toLowerCase();
    let slot: string;
    if (BORDER_STYLES.has(lower)) slot = style;
    else if (isLength(token) || BORDER_WIDTH_KEYWORDS.has(lower)) slot = width;
    else if (looksLikeColor(token)) slot = color;
    else return `unrecognised token "${token}"`;
    if (seen.has(slot)) return `duplicate ${slot} in "${value}"`;
    seen.add(slot);
    out[slot] = slot === width ? keep(value, token) : token;
  }
  return out;
}

const DIRECTIONS = new Set(["row", "row-reverse", "column", "column-reverse"]);
const WRAPS = new Set(["nowrap", "wrap", "wrap-reverse"]);

export function expandFlexFlow(value: string | number): LeafResult {
  const t = tokens(value);
  if (t.length < 1 || t.length > 2) return `expected 1 or 2 values, got ${t.length}`;
  const out: Record<string, Leaf> = { flexDirection: "row", flexWrap: "nowrap" };
  for (const token of t) {
    if (DIRECTIONS.has(token)) out.flexDirection = token;
    else if (WRAPS.has(token)) out.flexWrap = token;
    else return `unrecognised token "${token}"`;
  }
  return out;
}

/**
 * `flex`. Numbers pass through as React Native's own `flex` (its semantics
 * differ from CSS for 0 and negatives), so the caller only uses this for
 * strings. `none` = 0 0 auto, `auto` = 1 1 auto, one number = n 1 0%.
 */
export function expandFlex(value: string): LeafResult {
  const t = tokens(value);
  if (t.length < 1 || t.length > 3) return `expected 1 to 3 values, got ${t.length}`;
  if (t.length === 1) {
    const [only] = t as [string];
    if (only === "none") return { flexGrow: 0, flexShrink: 0, flexBasis: "auto" };
    if (only === "auto") return { flexGrow: 1, flexShrink: 1, flexBasis: "auto" };
    if (only === "initial") return { flexGrow: 0, flexShrink: 1, flexBasis: "auto" };
    if (isNumber(only)) return { flexGrow: Number(only), flexShrink: 1, flexBasis: "0%" };
    if (isLength(only)) return { flexGrow: 1, flexShrink: 1, flexBasis: only };
    return `unrecognised token "${only}"`;
  }
  const numbers = t.filter(isNumber).map(Number);
  const rest = t.filter((x) => !isNumber(x));
  if (rest.length > 1 || (rest[0] !== undefined && !isLength(rest[0]) && rest[0] !== "auto")) {
    return `unrecognised flex value "${value}"`;
  }
  const [grow = 1, shrink = 1] = numbers;
  return {
    flexGrow: grow,
    flexShrink: shrink,
    flexBasis: rest[0] ?? (numbers.length === 2 ? "0%" : "0%"),
  };
}

const DECORATION_LINES = new Set(["none", "underline", "overline", "line-through", "blink"]);
const DECORATION_STYLES = new Set(["solid", "double", "dotted", "dashed", "wavy"]);

export function expandTextDecoration(value: string | number): LeafResult {
  const t = tokens(value);
  if (t.length < 1) return "expected a value";
  const lines: string[] = [];
  const out: Record<string, Leaf> = {
    textDecorationLine: "none",
    textDecorationStyle: "solid",
    textDecorationColor: "currentcolor",
  };
  for (const token of t) {
    if (DECORATION_LINES.has(token)) lines.push(token);
    else if (DECORATION_STYLES.has(token)) out.textDecorationStyle = token;
    else if (looksLikeColor(token)) out.textDecorationColor = token;
    else return `unrecognised token "${token}"`;
  }
  if (lines.length) out.textDecorationLine = lines.join(" ");
  return out;
}

/** `<offset-x> <offset-y> [blur] [color]`; only the first shadow of a list is kept. */
export function expandTextShadow(value: string | number): LeafResult {
  if (typeof value === "number") return "expected offsets and an optional color";
  const shadows = splitComma(value);
  const [first] = shadows;
  if (first === undefined) return "expected a value";
  const t = splitSpace(first);
  if (t.length === 1 && t[0] === "none") {
    return {
      textShadowOffsetX: 0,
      textShadowOffsetY: 0,
      textShadowRadius: 0,
      textShadowColor: null,
    };
  }
  const lengths = t.filter(isLength);
  const colors = t.filter((x) => !isLength(x));
  if (lengths.length < 2 || lengths.length > 3 || colors.length > 1) {
    return `unrecognised text-shadow "${first}"`;
  }
  const [x, y, blur = 0] = lengths as [string, string, string?];
  return {
    textShadowOffsetX: x,
    textShadowOffsetY: y,
    textShadowRadius: blur,
    textShadowColor: colors[0] ?? "currentcolor",
  };
}

const TIMING_KEYWORDS = new Set([
  "ease",
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "step-start",
  "step-end",
]);
const isTiming = (t: string): boolean =>
  TIMING_KEYWORDS.has(t) || /^(cubic-bezier|steps|linear)\(/.test(t);

type ListParse = { fields: Record<string, string[]>; error?: string };

function parseList(
  value: string,
  parseItem: (t: string[]) => Record<string, string> | string,
): ListParse {
  const fields: Record<string, string[]> = {};
  for (const item of splitComma(value)) {
    const parsed = parseItem(splitSpace(item));
    if (typeof parsed === "string") return { fields, error: parsed };
    for (const [k, v] of Object.entries(parsed)) (fields[k] ??= []).push(v);
  }
  return { fields };
}

const joinLists = (fields: Record<string, string[]>): Record<string, Leaf> =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.join(", ")]));

/** `[property] [duration] [timing] [delay]` per comma-separated item. */
export function expandTransition(value: string | number): LeafResult {
  if (typeof value === "number") return "expected a transition";
  const { fields, error } = parseList(value, (t) => {
    const out = {
      transitionProperty: "all",
      transitionDuration: "0s",
      transitionTimingFunction: "ease",
      transitionDelay: "0s",
    };
    const times = t.filter(isTime);
    if (times.length > 2) return `too many times in "${t.join(" ")}"`;
    if (times[0] !== undefined) out.transitionDuration = times[0];
    if (times[1] !== undefined) out.transitionDelay = times[1];
    const rest = t.filter((x) => !isTime(x));
    for (const token of rest) {
      if (isTiming(token)) out.transitionTimingFunction = token;
      else if (isIdent(token)) out.transitionProperty = token;
      else return `unrecognised token "${token}"`;
    }
    return out;
  });
  return error ?? joinLists(fields);
}

const DIRECTIONS_ANIM = new Set(["normal", "reverse", "alternate", "alternate-reverse"]);
const FILL_MODES = new Set(["none", "forwards", "backwards", "both"]);
const PLAY_STATES = new Set(["running", "paused"]);

/** `[name] [duration] [timing] [delay] [count] [direction] [fill] [play-state]` per item. */
export function expandAnimation(value: string | number): LeafResult {
  if (typeof value === "number") return "expected an animation";
  const { fields, error } = parseList(value, (t) => {
    const out = {
      animationName: "none",
      animationDuration: "0s",
      animationTimingFunction: "ease",
      animationDelay: "0s",
      animationIterationCount: "1",
      animationDirection: "normal",
      animationFillMode: "none",
      animationPlayState: "running",
    };
    const times = t.filter(isTime);
    if (times.length > 2) return `too many times in "${t.join(" ")}"`;
    if (times[0] !== undefined) out.animationDuration = times[0];
    if (times[1] !== undefined) out.animationDelay = times[1];
    let nameSeen = false;
    for (const token of t.filter((x) => !isTime(x))) {
      if (isTiming(token)) out.animationTimingFunction = token;
      else if (isNumber(token) || token === "infinite") out.animationIterationCount = token;
      else if (DIRECTIONS_ANIM.has(token)) out.animationDirection = token;
      else if (FILL_MODES.has(token) && (nameSeen || token !== "none"))
        out.animationFillMode = token;
      else if (PLAY_STATES.has(token)) out.animationPlayState = token;
      else if (isIdent(token) && !nameSeen) {
        out.animationName = token;
        nameSeen = true;
      } else if (isFunction(token)) return `unrecognised function "${token}"`;
      else return `unrecognised token "${token}"`;
    }
    return out;
  });
  return error ?? joinLists(fields);
}

/** `background`: a single color only. */
export function expandBackground(value: string | number): LeafResult {
  if (typeof value === "number") return "expected a color";
  const t = splitSpace(value);
  const [only] = t;
  if (t.length !== 1 || only === undefined) return "only a single background color is supported";
  if (only === "none") return { backgroundColor: "transparent" };
  if (!looksLikeColor(only)) return `only a single background color is supported, got "${only}"`;
  return { backgroundColor: only };
}

/** Which expander handles which shorthand. Longhand names come from the compat table. */
export const expanders: Readonly<Record<string, Expander>> = {
  margin: (v) => expandBox(v, ["marginTop", "marginRight", "marginBottom", "marginLeft"]),
  padding: (v) => expandBox(v, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]),
  inset: (v) => expandBox(v, ["top", "right", "bottom", "left"]),
  borderWidth: (v) =>
    expandBox(v, ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"]),
  borderColor: (v) =>
    expandBox(v, ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"]),
  borderStyle: (v) =>
    expandBox(v, ["borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle"]),
  borderRadius: (v) =>
    expandCorners(v, [
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ]),
  marginBlock: (v) => expandPair(v, ["marginBlockStart", "marginBlockEnd"]),
  marginInline: (v) => expandPair(v, ["marginInlineStart", "marginInlineEnd"]),
  paddingBlock: (v) => expandPair(v, ["paddingBlockStart", "paddingBlockEnd"]),
  paddingInline: (v) => expandPair(v, ["paddingInlineStart", "paddingInlineEnd"]),
  insetBlock: (v) => expandPair(v, ["insetBlockStart", "insetBlockEnd"]),
  insetInline: (v) => expandPair(v, ["insetInlineStart", "insetInlineEnd"]),
  borderBlockWidth: (v) => expandPair(v, ["borderTopWidth", "borderBottomWidth"]),
  borderInlineWidth: (v) => expandPair(v, ["borderStartWidth", "borderEndWidth"]),
  borderBlockColor: (v) => expandPair(v, ["borderBlockStartColor", "borderBlockEndColor"]),
  borderInlineColor: (v) => expandPair(v, ["borderStartColor", "borderEndColor"]),
  borderBlockStyle: (v) => expandPair(v, ["borderBlockStartStyle", "borderBlockEndStyle"]),
  borderInlineStyle: (v) => expandPair(v, ["borderInlineStartStyle", "borderInlineEndStyle"]),
  gap: (v) => expandPair(v, ["rowGap", "columnGap"]),
  placeContent: (v) => expandPair(v, ["alignContent", "justifyContent"]),
  flexFlow: expandFlexFlow,
  flex: (v) => (typeof v === "number" ? { flex: v } : expandFlex(v)),
  border: (v) => expandBorderLike(v, ["borderWidth", "borderStyle", "borderColor"]),
  borderTop: (v) => expandBorderLike(v, ["borderTopWidth", "borderTopStyle", "borderTopColor"]),
  borderRight: (v) =>
    expandBorderLike(v, ["borderRightWidth", "borderRightStyle", "borderRightColor"]),
  borderBottom: (v) =>
    expandBorderLike(v, ["borderBottomWidth", "borderBottomStyle", "borderBottomColor"]),
  borderLeft: (v) => expandBorderLike(v, ["borderLeftWidth", "borderLeftStyle", "borderLeftColor"]),
  borderBlock: (v) =>
    expandBorderLike(v, ["borderBlockWidth", "borderBlockStyle", "borderBlockColor"]),
  borderBlockStart: (v) =>
    expandBorderLike(v, [
      "borderBlockStartWidth",
      "borderBlockStartStyle",
      "borderBlockStartColor",
    ]),
  borderBlockEnd: (v) =>
    expandBorderLike(v, ["borderBlockEndWidth", "borderBlockEndStyle", "borderBlockEndColor"]),
  borderInline: (v) =>
    expandBorderLike(v, ["borderInlineWidth", "borderInlineStyle", "borderInlineColor"]),
  borderInlineStart: (v) =>
    expandBorderLike(v, [
      "borderInlineStartWidth",
      "borderInlineStartStyle",
      "borderInlineStartColor",
    ]),
  borderInlineEnd: (v) =>
    expandBorderLike(v, ["borderInlineEndWidth", "borderInlineEndStyle", "borderInlineEndColor"]),
  outline: (v) => expandBorderLike(v, ["outlineWidth", "outlineStyle", "outlineColor"]),
  textDecoration: expandTextDecoration,
  textShadow: expandTextShadow,
  transition: expandTransition,
  animation: expandAnimation,
  background: expandBackground,
};
