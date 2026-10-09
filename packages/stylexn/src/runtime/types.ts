import type { CompiledLeaf, CompiledRule } from "../compile/compile.ts";
import type { Declarations } from "../expand/types.ts";
import type { RNLeaf } from "../lower/lower.ts";
import type { AnimationSpec, TransitionSpec } from "./motion.ts";

export type { CompiledRule };

/** A reference to a variable from `defineVars`, as it appears in style values. */
export type VarRef = Readonly<{ $$stylexnVar: string }>;

/** A theme from `createTheme`: overrides for a var group, applied per element or via ThemeProvider. */
export type Theme = Readonly<{ $$stylexnTheme: Readonly<Record<string, RuntimeValue>> }>;

/**
 * A value at runtime: a compiled leaf, a var reference, or a conditional
 * object (variables may carry `@media` defaults). Objects are told apart at
 * runtime by their keys.
 */
export type RuntimeValue = CompiledLeaf;

export type VarScope = Readonly<Record<string, RuntimeValue>>;

export type InteractionState = Readonly<{
  hover?: boolean;
  active?: boolean;
  focus?: boolean;
  focusVisible?: boolean;
  focusWithin?: boolean;
  disabled?: boolean;
  /** `:checked`: a Switch's value. */
  checked?: boolean;
  /** `:placeholder-shown`: a TextInput with a placeholder and no text. */
  placeholderShown?: boolean;
  /** `:read-only` / `:read-write` (together with `disabled`). */
  readOnly?: boolean;
}>;

export type WindowMetrics = Readonly<{
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}>;

export type Env = Readonly<{
  window: WindowMetrics;
  colorScheme: "light" | "dark";
  reducedMotion: boolean;
  /** `prefers-contrast`: iOS Increase Contrast / Android high-contrast text. */
  contrast: "more" | "no-preference";
  /** `prefers-reduced-transparency`: iOS Reduce Transparency (always false on Android). */
  reducedTransparency: boolean;
  /** `inverted-colors`: iOS Smart/Classic Invert (always false on Android). */
  invertedColors: boolean;
  /** Assumed input capabilities for `hover`/`pointer` media features. */
  pointer: "coarse" | "fine" | "none";
  interaction: InteractionState;
  vars: VarScope;
  /** Pixel size of 1rem. */
  rootFontSize: number;
  /** Inherited font size for `em` when the element sets none. */
  fontSize: number;
  platform: "ios" | "android";
}>;

/** Which parts of the environment a set of rules depends on. */
export type Needs = Readonly<{
  interaction: boolean;
  dimensions: boolean;
  colorScheme: boolean;
  reducedMotion: boolean;
  /** A `prefers-contrast` media condition. */
  contrast: boolean;
  /** A `prefers-reduced-transparency` media condition. */
  reducedTransparency: boolean;
  /** An `inverted-colors` media condition. */
  invertedColors: boolean;
  vars: boolean;
  /** Any transition or animation declaration: the element needs a motion controller. */
  motion: boolean;
  /**
   * Nothing depends on the environment (no conditions, variables, relative
   * units, deferred math or motion): the resolved style is the same for
   * every element and every render, and `resolve` caches it.
   */
  constant: boolean;
}>;

/** What `props()` accepts: compiled rules, themes, falsy, or nested arrays of those. */
export type StyleArg = CompiledRule | Theme | null | undefined | false | readonly StyleArg[];

export type Resolved = Readonly<{
  style: Readonly<Record<string, RNLeaf>>;
  props: Readonly<Record<string, RNLeaf>>;
  needs: Needs;
  /** Parsed `transition*` declarations, when any. */
  transition?: TransitionSpec;
  /** Parsed `animation*` declarations, in list order, when any. */
  animations?: readonly AnimationSpec[];
  /**
   * Inherited text values that differ from what the element renders: a
   * unitless `lineHeight` is applied to the element as a number but cascades
   * to text descendants as the multiplier (a bare number string).
   */
  inherit?: Readonly<Record<string, RNLeaf>>;
}>;

// ---------------------------------------------------------------------------
// StyleX's type names, mapped to their native shapes, so shared code typed
// with them (`StyleXStyles` props, ...) compiles on both entries. `Theme`
// and `VarGroup` already exist above and in vars.ts under the same names;
// `Keyframes` on native is the registered animation, not the input type.
// ---------------------------------------------------------------------------

/** Anything `props()` accepts: a compiled rule, a theme, or arrays of those. */
export type StyleXStyles<T = unknown> = StyleArg | (T & never);
export type StyleXStylesWithout<T> = StyleArg | (T & never);
export type StaticStyles<T = unknown> = StyleArg | (T & never);
export type StaticStylesWithout<T> = StyleArg | (T & never);
export type CompiledStyles = CompiledRule;
export type InlineStyles = CompiledRule;
export type StyleXArray<T> = T | readonly StyleXArray<T>[];
export type StyleXVar<V = unknown> = VarRef | (V & never);
export type CSSProperties = Declarations;
/** What `create()` returns: a compiled rule per name, or a function returning one. */
export type MapNamespaces<S> = {
  readonly [K in keyof S]: S[K] extends (...args: infer A) => unknown
    ? (...args: A) => CompiledRule
    : CompiledRule;
};

export function isCompiledRule(value: unknown): value is CompiledRule {
  return (
    typeof value === "object" && value !== null && (value as { $$stylexn?: number }).$$stylexn === 1
  );
}

export function isVarRef(value: unknown): value is VarRef {
  return typeof value === "object" && value !== null && "$$stylexnVar" in value;
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === "object" && value !== null && "$$stylexnTheme" in value;
}
