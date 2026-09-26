import { propertyEntries as properties } from "../compat/table.ts";
import { splitComma, splitSpace } from "../expand/tokenize.ts";
import type { ConditionalValue, Diagnostic, Expanded, Leaf } from "../expand/types.ts";
import { isConditional } from "../expand/types.ts";
import { isSentinel } from "../sentinel.ts";
import { convertColor } from "./color.ts";
import { foldedToken, foldMath, mapFunctions } from "./fold.ts";
import { normalizeAngles, toNumber } from "./units.ts";

/**
 * A value React Native can take, plus the string forms the runtime still has
 * to resolve (relative units, var() references, condition objects).
 */
export type RNLeaf =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | Readonly<{ width: RNLeaf; height: RNLeaf }>;

export type LoweredValue = RNLeaf | Readonly<{ [condition: string]: LoweredValue }>;

export type LoweredRule = Readonly<{
  /** React Native style keys. */
  style: Readonly<Record<string, LoweredValue>>;
  /** Component props derived from styles (placeholderTextColor, numberOfLines, ...). */
  props: Readonly<Record<string, LoweredValue>>;
  /** Shorthand depth per style key, carried over from expansion for the merge. */
  depth: Readonly<Record<string, number>>;
  diagnostics: readonly Diagnostic[];
}>;

const CONDITION_KEY = /^(default$|:|@)/;

export function isLoweredConditional(
  value: LoweredValue,
): value is Readonly<{ [condition: string]: LoweredValue }> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => CONDITION_KEY.test(k));
}

// ---------------------------------------------------------------------------
// Stage 1: per-property lowering (compile-time safe, conditional-aware)
// ---------------------------------------------------------------------------

type LeafOutput = Readonly<{ style?: Record<string, RNLeaf>; props?: Record<string, RNLeaf> }>;
type LeafLowerer = (value: string | number, diag: (message: string) => void) => LeafOutput;

const DROP: LeafOutput = {};
const BORDER_WIDTH_KEYWORDS: Readonly<Record<string, number>> = { thin: 1, medium: 3, thick: 5 };
const BORDER_STYLE_FALLBACK: Readonly<Record<string, string>> = {
  double: "solid",
  groove: "solid",
  ridge: "solid",
  inset: "solid",
  outset: "solid",
  auto: "solid",
};
const ELLIPSIZE: Readonly<Record<string, string>> = { ellipsis: "tail", clip: "clip" };

const isColorProperty = (property: string): boolean =>
  property === "color" || property.endsWith("Color");
const isSideStyle = (property: string): boolean => /^(border|outline).*Style$/.test(property);
const isWidthProperty = (property: string): boolean => /^(border.*|outline)Width$/.test(property);

/** Property-specific leaf lowerers. Anything not listed goes through `lowerGeneric`. */
const special: Readonly<Record<string, LeafLowerer>> = {
  lineHeight: (v, diag) => {
    if (typeof v === "number") return { style: { lineHeight: `${v}em` } }; // unitless multiplier
    if (v === "normal") return DROP; // React Native's default
    return lowerLength("lineHeight", v, diag);
  },
  fontFamily: (v) => {
    const [first = ""] = splitComma(String(v));
    return { style: { fontFamily: first.replace(/^["']|["']$/g, "") } };
  },
  fontWeight: (v, diag) => {
    if (v === "bolder" || v === "lighter") {
      diag(`fontWeight "${v}" is relative to the parent; use an explicit weight`);
      return DROP;
    }
    return { style: { fontWeight: v } };
  },
  fontVariant: (v) => ({ style: { fontVariant: v === "normal" ? [] : splitSpace(String(v)) } }),
  letterSpacing: (v, diag) =>
    v === "normal" ? { style: { letterSpacing: 0 } } : lowerLength("letterSpacing", v, diag),
  aspectRatio: (v) => ({
    style: { aspectRatio: typeof v === "number" ? v : v.replace(/\s+/g, "") },
  }),
  transform: (v) => ({ style: { transform: normalizeAngles(String(v)) } }),
  textDecorationLine: (v, diag) => {
    const lines = splitSpace(String(v)).filter((l) => {
      if (l === "overline" || l === "blink") {
        diag(`textDecorationLine "${l}" is not supported`);
        return false;
      }
      return true;
    });
    const kept = lines.filter((l) => l !== "none");
    return { style: { textDecorationLine: kept.length ? kept.join(" ") : "none" } };
  },
  textOverflow: (v, diag) => {
    const mode = ELLIPSIZE[String(v)];
    if (!mode) {
      diag(`textOverflow "${v}" is not supported`);
      return DROP;
    }
    return { props: { ellipsizeMode: mode } };
  },
  lineClamp: (v) => ({ props: { numberOfLines: v === "none" ? 0 : Number(v) } }),
  WebkitLineClamp: (v) => ({ props: { numberOfLines: v === "none" ? 0 : Number(v) } }),
  visibility: (v) => (v === "hidden" ? { style: { opacity: 0, pointerEvents: "none" } } : DROP),
  opacity: (v) => ({ style: { opacity: typeof v === "number" ? v : Number(v) } }),
};

function lowerLength(key: string, v: string | number, diag: (m: string) => void): LeafOutput {
  if (typeof v === "number") return { style: { [key]: v } };
  const n = toNumber(v);
  if (n !== null) return { style: { [key]: n } };
  if (isWidthProperty(key)) {
    const kw = BORDER_WIDTH_KEYWORDS[v];
    if (kw !== undefined) return { style: { [key]: kw } };
    diag(`${key} "${v}" is not a length`);
    return DROP;
  }
  return { style: { [key]: v } }; // %, relative units, keywords: runtime or compat decide
}

function lowerGeneric(property: string, v: string | number, diag: (m: string) => void): LeafOutput {
  const entry = properties[property];
  const key = entry?.native ?? property;
  if (entry?.prop) return { props: { [entry.prop]: v } };
  if (isColorProperty(property) && v === "currentcolor") {
    diag(`${property}: currentcolor is not supported; set the color explicitly`);
    return DROP;
  }
  if (isSideStyle(property) && typeof v === "string") {
    const fallback = BORDER_STYLE_FALLBACK[v];
    if (fallback) diag(`${property} "${v}" is rendered as ${fallback}`);
    return { style: { [key]: fallback ?? v } };
  }
  return lowerLength(key, v, diag);
}

/**
 * Fold `calc()`-style math and convert CIE/OK/`color-mix()` colors anywhere
 * in a value, including inside other functions (`translateX(calc(...))`,
 * gradient stops). Math that needs runtime context (relative units, var())
 * is left as written for the runtime. Returns null (with a diagnostic) when
 * a function cannot be made static at all.
 */
function foldFunctions(value: string, diag: (message: string) => void): string | null {
  if (!value.includes("(")) return value;
  return mapFunctions(value, (token) => {
    const math = foldMath(token);
    if (math) {
      if (math.ok === "runtime") return token;
      if (!math.ok) {
        diag(math.reason);
        return null;
      }
      return foldedToken(math);
    }
    const color = convertColor(token);
    if (color) {
      if (!color.ok) {
        diag(color.reason);
        return null;
      }
      return color.value;
    }
    return undefined;
  });
}

function lowerLeaf(
  property: string,
  value: Leaf,
  diagnostics: Diagnostic[],
  path: string,
): LeafOutput {
  const diag = (message: string) => diagnostics.push({ property: path, value, message });
  if (typeof value === "string" && !isSentinel(value)) {
    const folded = foldFunctions(value, diag);
    if (folded === null) return DROP;
    value = folded;
  }
  if (isSentinel(value)) {
    // Only known at runtime: rename/prop-map it, never inspect it.
    const entry = properties[property];
    return entry?.prop
      ? { props: { [entry.prop]: value } }
      : { style: { [entry?.native ?? property]: value } };
  }
  if (value === null) {
    const entry = properties[property];
    return entry?.prop
      ? { props: { [entry.prop]: null } }
      : { style: { [entry?.native ?? property]: null } };
  }
  return (special[property] ?? ((v, d) => lowerGeneric(property, v, d)))(value, diag);
}

type Grouped = { style: Record<string, LoweredValue>; props: Record<string, LoweredValue> };

/** Lower each branch of a conditional and regroup per output key. */
function lowerConditional(
  property: string,
  value: ConditionalValue,
  diagnostics: Diagnostic[],
  path: string,
): Grouped {
  const out: Grouped = { style: {}, props: {} };
  for (const [condition, branch] of Object.entries(value)) {
    const branchPath = `${path}[${condition}]`;
    // ::placeholder is the one pseudo-element with a native home: a prop.
    if (condition === "::placeholder") {
      if (property === "color" && !isConditional(branch)) {
        out.props.placeholderTextColor = branch;
      } else {
        diagnostics.push({
          property: branchPath,
          value: isConditional(branch) ? null : branch,
          message: "::placeholder only supports a static color",
        });
      }
      continue;
    }
    const lowered = isConditional(branch)
      ? lowerConditional(property, branch, diagnostics, branchPath)
      : toGrouped(lowerLeaf(property, branch, diagnostics, branchPath));
    for (const bucket of ["style", "props"] as const) {
      for (const [k, v] of Object.entries(lowered[bucket])) {
        const existing = out[bucket][k];
        out[bucket][k] = {
          ...(existing !== undefined && isLoweredConditional(existing) ? existing : {}),
          [condition]: v,
        };
      }
    }
  }
  return out;
}

const toGrouped = (o: LeafOutput): Grouped => ({ style: o.style ?? {}, props: o.props ?? {} });

/**
 * Lower an expanded rule to React Native keys and derived props. Safe at
 * compile time: it never combines properties, so the merge can still resolve
 * specificity afterwards. Conditions are preserved per output key.
 */
export function lowerDeclarations(expanded: Expanded): LoweredRule {
  const style: Record<string, LoweredValue> = {};
  const props: Record<string, LoweredValue> = {};
  const depth: Record<string, number> = {};
  const diagnostics: Diagnostic[] = [];

  for (const [property, value] of Object.entries(expanded.style)) {
    const lowered = isConditional(value)
      ? lowerConditional(property, value, diagnostics, property)
      : toGrouped(lowerLeaf(property, value, diagnostics, property));
    const d = expanded.depth[property] ?? 0;
    for (const [k, v] of Object.entries(lowered.style)) {
      style[k] = v;
      if (d > 0) depth[k] = d;
    }
    Object.assign(props, lowered.props);
  }
  return { style, props, depth, diagnostics };
}

// ---------------------------------------------------------------------------
// Stage 2: finalize a merged, condition-resolved style (runtime)
// ---------------------------------------------------------------------------

export type FinalStyle = Readonly<Record<string, RNLeaf>>;

/** Per-side style key -> the width key that must go to 0 for `none`. */
const SIDE_STYLES: Readonly<Record<string, string>> = {
  borderTopStyle: "borderTopWidth",
  borderRightStyle: "borderRightWidth",
  borderBottomStyle: "borderBottomWidth",
  borderLeftStyle: "borderLeftWidth",
  borderBlockStartStyle: "borderTopWidth",
  borderBlockEndStyle: "borderBottomWidth",
  borderInlineStartStyle: "borderStartWidth",
  borderInlineEndStyle: "borderEndWidth",
};

/**
 * Collapse the things React Native cannot express per property, on a style
 * whose conditions have already been resolved to leaves:
 * - per-side border styles -> one `borderStyle` (`none` zeroes that side's width)
 * - `outlineStyle: none` -> `outlineWidth: 0`
 * - `textShadowOffsetX/Y` -> `textShadowOffset: { width, height }`
 * - duplicate `fontVariant` sources are already merged by key; arrays pass through
 */
export function finalizeStyle(input: FinalStyle): Readonly<{
  style: FinalStyle;
  diagnostics: readonly Diagnostic[];
}> {
  const style: Record<string, RNLeaf> = { ...input };
  const diagnostics: Diagnostic[] = [];

  const sideStyles: string[] = [];
  for (const [sideKey, widthKey] of Object.entries(SIDE_STYLES)) {
    const v = style[sideKey];
    if (v === undefined) continue;
    delete style[sideKey];
    if (v === null) continue;
    if (v === "none" || v === "hidden") {
      style[widthKey] = 0;
      continue;
    }
    sideStyles.push(String(v));
  }
  if (sideStyles.length) {
    const [first] = sideStyles as [string];
    const distinct = new Set(sideStyles);
    if (distinct.size > 1) {
      diagnostics.push({
        property: "borderStyle",
        value: [...distinct].join(", "),
        message: `React Native has one borderStyle for all sides; using "${first}"`,
      });
    }
    style.borderStyle = first;
  }

  if (style.outlineStyle === "none" || style.outlineStyle === "hidden") {
    delete style.outlineStyle;
    style.outlineWidth = 0;
  }

  if ("textShadowOffsetX" in style || "textShadowOffsetY" in style) {
    const width = style.textShadowOffsetX ?? 0;
    const height = style.textShadowOffsetY ?? 0;
    delete style.textShadowOffsetX;
    delete style.textShadowOffsetY;
    style.textShadowOffset = { width, height };
  }

  return { style, diagnostics };
}
