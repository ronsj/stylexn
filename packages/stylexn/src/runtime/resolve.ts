import type { CompiledEntry, CompiledRule } from "../compile/compile.ts";
import type { RNLeaf } from "../lower/lower.ts";
import { finalizeStyle } from "../lower/lower.ts";
import { parseLength, RELATIVE_UNITS } from "../lower/units.ts";
import { matchesMedia } from "./media.ts";
import type { Env, Needs, Resolved, RuntimeValue, StyleArg, Theme } from "./types.ts";
import { isCompiledRule, isTheme, isVarRef } from "./types.ts";
import { lookupVar } from "./vars.ts";

const ANIMATION_KEY = /^(transition|animation)[A-Z]|^(transition|animation)$/;
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[stylexn] ${message}`);
}

/** Split `props()` arguments into rules and element-level themes, in order. */
export function flattenArgs(args: readonly StyleArg[]): { rules: CompiledRule[]; themes: Theme[] } {
  const rules: CompiledRule[] = [];
  const themes: Theme[] = [];
  const visit = (arg: StyleArg): void => {
    if (!arg) return;
    if (Array.isArray(arg)) {
      for (const a of arg) visit(a as StyleArg);
    } else if (isCompiledRule(arg)) {
      rules.push(arg);
    } else if (isTheme(arg)) {
      themes.push(arg);
    }
  };
  for (const a of args) visit(a);
  return { rules, themes };
}

const DIMENSION_FEATURE = /\b(width|height|aspect-ratio|orientation|resolution)\b/;

/** Static analysis of which environment parts the rules can depend on. */
export function analyzeNeeds(rules: readonly CompiledRule[]): Needs {
  let interaction = false;
  let dimensions = false;
  let colorScheme = false;
  let reducedMotion = false;
  let vars = false;
  const visitWhen = (when: readonly string[]) => {
    for (const c of when) {
      if (c.startsWith(":")) interaction = true;
      else if (c.startsWith("@media")) {
        if (DIMENSION_FEATURE.test(c)) dimensions = true;
        if (c.includes("prefers-color-scheme")) colorScheme = true;
        if (c.includes("prefers-reduced-motion")) reducedMotion = true;
      }
    }
  };
  for (const rule of rules) {
    if (rule.usesVars) vars = true;
    for (const e of rule.conditional) visitWhen(e.when);
    for (const e of rule.conditionalProps) visitWhen(e.when);
  }
  // Variables may carry media defaults; subscribe conservatively.
  if (vars) {
    dimensions = true;
    colorScheme = true;
  }
  return { interaction, dimensions, colorScheme, reducedMotion, vars };
}

function conditionHolds(condition: string, env: Env): boolean {
  if (condition.startsWith("@media")) return matchesMedia(condition, env);
  if (condition.startsWith("@")) return false; // @supports, @container: never on native
  const i = env.interaction;
  switch (condition) {
    case ":hover":
      return i.hover === true;
    case ":active":
      return i.active === true;
    case ":focus":
      return i.focus === true;
    case ":focus-visible":
      return i.focusVisible ?? i.focus === true;
    case ":focus-within":
      return i.focusWithin ?? i.focus === true;
    case ":disabled":
      return i.disabled === true;
    case ":enabled":
      return i.disabled !== true;
    default:
      return false;
  }
}

function whenHolds(when: readonly string[], env: Env): boolean {
  return when.every((c) => conditionHolds(c, env));
}

type Assignment = { key: string; value: RuntimeValue; depth: number };

/** Merge rules in application order with property-specificity, like `mergeExpanded`. */
function merge(
  rules: readonly CompiledRule[],
  env: Env,
  pick: (rule: CompiledRule) => {
    static: Readonly<Record<string, RuntimeValue>>;
    conditional: readonly CompiledEntry[];
  },
): Map<string, Assignment> {
  const out = new Map<string, Assignment>();
  const apply = (key: string, value: RuntimeValue, depth: number) => {
    const existing = out.get(key);
    if (existing && existing.depth < depth) return;
    out.set(key, { key, value, depth });
  };
  for (const rule of rules) {
    const part = pick(rule);
    for (const [key, value] of Object.entries(part.static)) apply(key, value, rule.depth[key] ?? 0);
    for (const entry of part.conditional) {
      if (whenHolds(entry.when, env)) apply(entry.key, entry.value, rule.depth[entry.key] ?? 0);
    }
  }
  return out;
}

/** Pick the applicable branch of a conditional runtime value (variables with media defaults). */
function resolveConditional(value: Readonly<Record<string, RuntimeValue>>, env: Env): RuntimeValue {
  let chosen: RuntimeValue = value.default ?? null;
  for (const [condition, branch] of Object.entries(value)) {
    if (condition === "default") continue;
    if (conditionHolds(condition, env)) {
      chosen =
        typeof branch === "object" && branch !== null && !isVarRef(branch) && !Array.isArray(branch)
          ? resolveConditional(branch as Readonly<Record<string, RuntimeValue>>, env)
          : branch;
    }
  }
  return chosen;
}

const VAR_STRING = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/;

function resolveValue(
  value: RuntimeValue,
  env: Env,
  themes: readonly Theme[],
  fontSize: number,
  guard = 0,
): RNLeaf {
  if (guard > 16) return null;
  if (isVarRef(value)) {
    const v = lookupVar(value.$$stylexnVar, env.vars, themes);
    if (v === undefined) {
      warnOnce(`var:${value.$$stylexnVar}`, `variable ${value.$$stylexnVar} has no value`);
      return null;
    }
    return resolveValue(v, env, themes, fontSize, guard + 1);
  }
  if (typeof value === "string") {
    const m = value.match(VAR_STRING);
    if (m) {
      const v = lookupVar(m[1] as string, env.vars, themes);
      if (v !== undefined) return resolveValue(v, env, themes, fontSize, guard + 1);
      return m[2] !== undefined ? resolveValue(m[2], env, themes, fontSize, guard + 1) : null;
    }
    return resolveUnits(value, env, fontSize);
  }
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    if ("width" in value && "height" in value && Object.keys(value).length === 2) {
      const box = value as Readonly<{ width: RuntimeValue; height: RuntimeValue }>;
      return {
        width: resolveValue(box.width, env, themes, fontSize, guard + 1),
        height: resolveValue(box.height, env, themes, fontSize, guard + 1),
      };
    }
    return resolveValue(
      resolveConditional(value as Readonly<Record<string, RuntimeValue>>, env),
      env,
      themes,
      fontSize,
      guard + 1,
    );
  }
  return value;
}

/** Convert a single relative-unit token to a number; other strings pass through. */
function resolveUnits(value: string, env: Env, fontSize: number): RNLeaf {
  const parsed = parseLength(value);
  if (!parsed || !RELATIVE_UNITS.has(parsed.unit)) return value;
  const { width, height } = env.window;
  switch (parsed.unit) {
    case "rem":
      return parsed.value * env.rootFontSize;
    case "em":
      return parsed.value * fontSize;
    case "vw":
    case "dvw":
    case "svw":
    case "lvw":
      return (parsed.value / 100) * width;
    case "vh":
    case "dvh":
    case "svh":
    case "lvh":
      return (parsed.value / 100) * height;
    case "vmin":
      return (parsed.value / 100) * Math.min(width, height);
    case "vmax":
      return (parsed.value / 100) * Math.max(width, height);
    default:
      return value;
  }
}

/**
 * Resolve `props()` arguments against an environment. Pure: everything the
 * result depends on is in `args` and `env`.
 */
export function resolve(args: readonly StyleArg[], env: Env): Resolved {
  const { rules, themes } = flattenArgs(args);
  const needs = analyzeNeeds(rules);

  const styleAssignments = merge(rules, env, (r) => ({
    static: r.static,
    conditional: r.conditional,
  }));
  const propAssignments = merge(rules, env, (r) => ({
    static: r.props,
    conditional: r.conditionalProps,
  }));

  // fontSize first: `em` on other properties is relative to it.
  const ownFontSize = styleAssignments.get("fontSize");
  let fontSize = env.fontSize;
  const style: Record<string, RNLeaf> = {};
  if (ownFontSize) {
    const resolved = resolveValue(ownFontSize.value, env, themes, env.fontSize);
    if (resolved !== null) style.fontSize = resolved;
    if (typeof resolved === "number") fontSize = resolved;
  }
  for (const { key, value } of styleAssignments.values()) {
    if (key === "fontSize") continue;
    if (ANIMATION_KEY.test(key)) {
      warnOnce(`anim:${key}`, `${key} is not implemented yet on native and was ignored`);
      continue;
    }
    const resolved = resolveValue(value, env, themes, fontSize);
    if (resolved !== null) style[key] = resolved;
  }

  const props: Record<string, RNLeaf> = {};
  for (const { key, value } of propAssignments.values()) {
    const resolved = resolveValue(value, env, themes, fontSize);
    if (resolved !== null) props[key] = resolved;
  }

  const finalized = finalizeStyle(style);
  return { style: finalized.style, props, needs };
}
