import type { CompiledLeaf, CompiledRule } from "../compile/compile.ts";
import type { RNLeaf } from "../lower/lower.ts";

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
  vars: boolean;
}>;

/** What `props()` accepts: compiled rules, themes, falsy, or nested arrays of those. */
export type StyleArg = CompiledRule | Theme | null | undefined | false | readonly StyleArg[];

export type Resolved = Readonly<{
  style: Readonly<Record<string, RNLeaf>>;
  props: Readonly<Record<string, RNLeaf>>;
  needs: Needs;
}>;

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
