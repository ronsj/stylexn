import type { CompiledEntry, CompiledRule } from "../compile/compile.ts";
import type { RNLeaf } from "../lower/lower.ts";
import {
  foldedToken,
  foldMath,
  isMathFunction,
  mapFunctions,
  MATH_ANYWHERE,
} from "../lower/fold.ts";
import { finalizeStyle } from "../lower/lower.ts";
import { parseLength, RELATIVE_UNITS } from "../lower/units.ts";
import { splitSpace } from "../expand/tokenize.ts";
import { matchesMedia } from "./media.ts";
import { MOTION_KEY, parseMotion } from "./motion.ts";
import type { Env, Needs, Resolved, RuntimeValue, StyleArg, Theme } from "./types.ts";
import { isCompiledRule, isTheme, isVarRef } from "./types.ts";
import { lookupVar } from "./vars.ts";
import { warnOnce } from "./warn.ts";

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
const VIEWPORT_UNIT = /\d(vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)\b/i;
/** Values `resolveValue` can only settle against an environment. */
const ENV_VALUE =
  /\d(rem|em|vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)\b|\b(var|calc|min|max|clamp)\(/i;
/** A unitless `lineHeight` (a multiplier of the font size). */
const UNITLESS_NUMBER = /^-?\d*\.?\d+$/;
const PERCENTAGE = /^-?\d*\.?\d+%$/;
/** Values that depend on the (inherited) font size, beyond `em`. */
const fontRelative = (key: string, v: string): boolean =>
  (key === "lineHeight" && UNITLESS_NUMBER.test(v)) || (key === "fontSize" && PERCENTAGE.test(v));

/**
 * What one rule needs, computed once per rule: rules are immutable and
 * long-lived (module-level `stylex.create` results), so the analysis is
 * cached on the rule itself. This is what makes `analyzeNeeds` cheap enough
 * to run on every render of every element instead of being memoised on the
 * (usually fresh) argument array.
 */
const ruleNeeds = new WeakMap<CompiledRule, Needs>();

function analyzeRule(rule: CompiledRule): Needs {
  const cached = ruleNeeds.get(rule);
  if (cached) return cached;
  let interaction = false;
  let dimensions = false;
  let colorScheme = false;
  let reducedMotion = false;
  let motion = false;
  let constant =
    !rule.usesVars && rule.conditional.length === 0 && rule.conditionalProps.length === 0;
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
  const visitValue = (k: string, v: unknown) => {
    if (typeof v === "string") {
      if (VIEWPORT_UNIT.test(v)) dimensions = true;
      if (constant && (ENV_VALUE.test(v) || fontRelative(k, v))) constant = false;
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      constant = false; // a var reference, a box or a conditional value
    }
  };
  const visitKey = (k: string) => {
    if (MOTION_KEY.test(k)) motion = true;
  };
  for (const [k, v] of Object.entries(rule.static)) {
    visitKey(k);
    visitValue(k, v);
  }
  for (const e of rule.conditional) {
    visitWhen(e.when);
    visitKey(e.key);
    visitValue(e.key, e.value);
  }
  for (const [k, v] of Object.entries(rule.props)) visitValue(k, v);
  for (const e of rule.conditionalProps) {
    visitWhen(e.when);
    visitValue(e.key, e.value);
  }
  if (motion) constant = false;
  // Variables may carry media defaults; subscribe conservatively.
  if (rule.usesVars) {
    dimensions = true;
    colorScheme = true;
  }
  // Motion honours prefers-reduced-motion.
  if (motion) reducedMotion = true;
  const needs: Needs = {
    interaction,
    dimensions,
    colorScheme,
    reducedMotion,
    vars: rule.usesVars,
    motion,
    constant,
  };
  ruleNeeds.set(rule, needs);
  return needs;
}

const NO_NEEDS: Needs = {
  interaction: false,
  dimensions: false,
  colorScheme: false,
  reducedMotion: false,
  vars: false,
  motion: false,
  constant: true,
};

/** Static analysis of which environment parts the rules can depend on. */
export function analyzeNeeds(rules: readonly CompiledRule[]): Needs {
  if (rules.length === 0) return NO_NEEDS;
  if (rules.length === 1) return analyzeRule(rules[0] as CompiledRule);
  let interaction = false;
  let dimensions = false;
  let colorScheme = false;
  let reducedMotion = false;
  let vars = false;
  let motion = false;
  let constant = true;
  for (const rule of rules) {
    const n = analyzeRule(rule);
    interaction ||= n.interaction;
    dimensions ||= n.dimensions;
    colorScheme ||= n.colorScheme;
    reducedMotion ||= n.reducedMotion;
    vars ||= n.vars;
    motion ||= n.motion;
    constant &&= n.constant;
  }
  return { interaction, dimensions, colorScheme, reducedMotion, vars, motion, constant };
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

const VAR_STRING = /^var\(\s*(--[\w.-]+)\s*(?:,\s*(.*))?\)$/;
const VAR_INLINE = /var\(\s*(--[\w.-]+)\s*(?:,\s*([^()]*))?\)/g;
const RELATIVE_LENGTH = /(-?\d*\.?\d+)(rem|em|vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)\b/gi;

/**
 * Fold math the compiler had to defer (relative units, var()) now that the
 * environment is known. Works on the whole value or nested inside other
 * functions; null when it still cannot be evaluated.
 */
function resolveMath(
  value: string,
  env: Env,
  themes: readonly Theme[],
  fontSize: number,
  guard: number,
): RNLeaf {
  let failure: string | null = null;
  const folded = mapFunctions(value, (token) => {
    if (!isMathFunction(token)) return undefined;
    const substituted = token
      .replace(VAR_INLINE, (_, name: string, fallback?: string) => {
        const v = lookupVar(name, env.vars, themes);
        const leaf =
          v === undefined
            ? fallback === undefined
              ? null
              : resolveValue(fallback.trim(), env, themes, fontSize, guard + 1)
            : resolveValue(v, env, themes, fontSize, guard + 1);
        if (leaf === null) {
          failure = `variable ${name} has no value`;
          return "0px";
        }
        return typeof leaf === "number" ? `${leaf}px` : String(leaf);
      })
      .replace(RELATIVE_LENGTH, (m) => {
        const n = resolveUnits(m, env, fontSize);
        return typeof n === "number" ? `${n}px` : m;
      });
    const r = foldMath(substituted);
    if (!r || r.ok !== true) {
      failure = r && r.ok === false ? r.reason : `${token}: cannot be resolved`;
      return null;
    }
    return foldedToken(r);
  });
  if (failure !== null || folded === null) {
    warnOnce(`math:${value}`, `${failure ?? value} (dropped)`);
    return null;
  }
  // A value that was a single math token becomes a number when it can.
  if (isMathFunction(value) && splitSpace(value).length === 1) {
    const n = parseLength(folded);
    if (n && (n.unit === "px" || n.unit === "")) return n.value;
  }
  return folded;
}

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
    if (MATH_ANYWHERE.test(value)) return resolveMath(value, env, themes, fontSize, guard);
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
 * Resolved results for constant rule lists, keyed by the rules in order (a
 * trie of WeakMaps, so garbage-collected rules take their entries with
 * them). A list of 1000 rows sharing a rule then resolves once.
 */
type CacheNode = { resolved?: Resolved; next: WeakMap<CompiledRule, CacheNode> };
const cacheRoot: CacheNode = { next: new WeakMap() };

/**
 * Resolve `props()` arguments against an environment. Pure: everything the
 * result depends on is in `args` and `env`. Constant rule lists (see
 * `Needs.constant`) resolve once and return the same object afterwards;
 * callers must not mutate the result.
 */
export function resolve(args: readonly StyleArg[], env: Env): Resolved {
  const { rules, themes } = flattenArgs(args);
  const needs = analyzeNeeds(rules);
  if (!needs.constant || themes.length) return resolveRules(rules, themes, env, needs);
  let node = cacheRoot;
  for (const rule of rules) {
    let next = node.next.get(rule);
    if (!next) {
      next = { next: new WeakMap() };
      node.next.set(rule, next);
    }
    node = next;
  }
  node.resolved ??= resolveRules(rules, themes, env, needs);
  return node.resolved;
}

function resolveRules(
  rules: readonly CompiledRule[],
  themes: readonly Theme[],
  env: Env,
  needs: Needs,
): Resolved {
  const styleAssignments = merge(rules, env, (r) => ({
    static: r.static,
    conditional: r.conditional,
  }));
  const propAssignments = merge(rules, env, (r) => ({
    static: r.props,
    conditional: r.conditionalProps,
  }));

  // fontSize first: `em` on other properties is relative to it. Percentages
  // and `em` on fontSize itself are relative to the inherited font size.
  const ownFontSize = styleAssignments.get("fontSize");
  let fontSize = env.fontSize;
  const style: Record<string, RNLeaf> = {};
  if (ownFontSize) {
    let resolved = resolveValue(ownFontSize.value, env, themes, env.fontSize);
    if (typeof resolved === "string" && PERCENTAGE.test(resolved)) {
      resolved = (Number(resolved.slice(0, -1)) / 100) * env.fontSize;
    }
    if (resolved !== null) style.fontSize = resolved;
    if (typeof resolved === "number") fontSize = resolved;
  }
  const motionDecls: Record<string, string> = {};
  let inherit: Record<string, RNLeaf> | undefined;
  for (const { key, value } of styleAssignments.values()) {
    if (key === "fontSize") continue;
    let resolved = resolveValue(value, env, themes, fontSize);
    if (resolved === null) continue;
    if (key === "lineHeight" && typeof resolved === "string" && UNITLESS_NUMBER.test(resolved)) {
      // The element gets the product; text inside it inherits the multiplier.
      inherit = { lineHeight: resolved };
      resolved = Number(resolved) * fontSize;
    }
    if (MOTION_KEY.test(key)) {
      // transition*/animation* describe motion, not appearance: parsed below, applied by useProps.
      if (typeof resolved === "string" || typeof resolved === "number") {
        motionDecls[key] = String(resolved);
      }
      continue;
    }
    style[key] = resolved;
  }

  const props: Record<string, RNLeaf> = {};
  for (const { key, value } of propAssignments.values()) {
    const resolved = resolveValue(value, env, themes, fontSize);
    if (resolved !== null) props[key] = resolved;
  }

  const finalized = finalizeStyle(style);
  const motion = Object.keys(motionDecls).length ? parseMotion(motionDecls, warnOnce) : {};
  return { style: finalized.style, props, needs, ...motion, ...(inherit && { inherit }) };
}
