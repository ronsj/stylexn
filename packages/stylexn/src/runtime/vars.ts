import type { RuntimeValue, Theme, VarRef, VarScope } from "./types.ts";

/**
 * Variables live in a module-level registry keyed by a generated name, the
 * way StyleX keys them by a file hash. Themes and providers override by name.
 */
const defaults = new Map<string, RuntimeValue>();
let groupCounter = 0;

export type VarGroup<T extends Record<string, RuntimeValue>> = Readonly<{
  [K in keyof T]: VarRef;
}> &
  Readonly<{ $$stylexnGroup: string }>;

/**
 * `stylex.defineVars`: register defaults and return references for use in
 * styles. `id` is injected by stylexn/babel (a hash of file and export name,
 * the way StyleX names its CSS variables). It keeps names stable across Fast
 * Refresh: re-running the module re-registers the same group, so components
 * still holding the old references keep resolving. Without the plugin a
 * process-level counter names the group.
 */
export function defineVars<T extends Record<string, RuntimeValue>>(
  values: T,
  id?: string,
): VarGroup<T> {
  const group = id ?? `v${++groupCounter}`;
  const refs: Record<string, VarRef> = {};
  for (const [key, value] of Object.entries(values)) {
    const name = `${group}.${key}`;
    defaults.set(name, value);
    // `${vars.gap}` inside a template string reads as var(--name), which the
    // runtime resolves like StyleX's CSS variables on web.
    refs[key] = Object.defineProperty({ $$stylexnVar: name }, "toString", {
      value: () => `var(--${name})`,
      enumerable: false,
    }) as VarRef;
  }
  return { ...refs, $$stylexnGroup: group } as VarGroup<T>;
}

/** `stylex.createTheme`: new values for an existing group. Unknown keys are ignored. */
export function createTheme<T extends Record<string, RuntimeValue>>(
  vars: VarGroup<T>,
  overrides: Partial<{ [K in keyof T]: RuntimeValue }>,
): Theme {
  const values: Record<string, RuntimeValue> = {};
  for (const [key, value] of Object.entries(overrides)) {
    const ref = (vars as Record<string, unknown>)[key];
    if (typeof ref === "object" && ref !== null && "$$stylexnVar" in ref && value !== undefined) {
      values[(ref as VarRef).$$stylexnVar] = value;
    }
  }
  return { $$stylexnTheme: values };
}

/** `stylex.defineConsts`: nothing to resolve at runtime; values are used as written. */
export function defineConsts<T extends Record<string, RuntimeValue>>(values: T): T {
  return values;
}

/** Look a variable up through element themes, provider scope, then defaults. */
export function lookupVar(
  rawName: string,
  scope: VarScope,
  themes: readonly Theme[],
): RuntimeValue | undefined {
  // `var(--v1.accent)` strings carry the CSS-style prefix; refs do not.
  const name = rawName.startsWith("--") && !defaults.has(rawName) ? rawName.slice(2) : rawName;
  for (let i = themes.length - 1; i >= 0; i--) {
    const v = themes[i]?.$$stylexnTheme[name];
    if (v !== undefined) return v;
  }
  if (name in scope) return scope[name];
  return defaults.get(name);
}

/** Merge themes into a scope for a ThemeProvider subtree. */
export function scopeWith(parent: VarScope, themes: readonly Theme[]): VarScope {
  const out: Record<string, RuntimeValue> = { ...parent };
  for (const theme of themes) Object.assign(out, theme.$$stylexnTheme);
  return out;
}

/** Test hook: forget every registered variable. */
export function resetVarsForTesting(): void {
  defaults.clear();
  groupCounter = 0;
}
