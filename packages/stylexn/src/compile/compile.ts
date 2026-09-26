import { checkDeclarations, isBlocking } from "../check/check.ts";
import type { CheckOptions, Finding } from "../check/check.ts";
import { expandDeclarations } from "../expand/expand.ts";
import type { Declarations, Diagnostic, Value } from "../expand/types.ts";
import { isConditional } from "../expand/types.ts";
import { lowerDeclarations } from "../lower/lower.ts";
import type { LoweredValue, RNLeaf } from "../lower/lower.ts";
import { isLoweredConditional } from "../lower/lower.ts";
import { isSentinel, makeSentinel, sentinelIndex } from "../sentinel.ts";

/**
 * A compiled value: something React Native can take, or an opaque runtime
 * object such as a `defineVars` reference that the runtime resolves.
 */
export type CompiledLeaf = RNLeaf | Readonly<Record<string, unknown>>;

/** One conditional declaration: apply `value` to `key` when every condition in `when` holds. */
export type CompiledEntry = Readonly<{
  key: string;
  when: readonly string[];
  value: CompiledLeaf;
}>;

export type CompiledRule = Readonly<{
  $$stylexn: 1;
  /** Unconditional React Native style. */
  static: Readonly<Record<string, CompiledLeaf>>;
  /** Conditional style entries, in declaration order. */
  conditional: readonly CompiledEntry[];
  /** Unconditional component props derived from styles. */
  props: Readonly<Record<string, CompiledLeaf>>;
  conditionalProps: readonly CompiledEntry[];
  /** Shorthand depth per style key (only keys with depth > 0), for the runtime merge. */
  depth: Readonly<Record<string, number>>;
  /** True when any value is only known at runtime (var references, dynamic params). */
  usesVars: boolean;
}>;

export type CompileOptions = CheckOptions &
  Readonly<{
    /** Keep unsupported declarations instead of stripping them (the caller errors). */
    strict?: boolean;
  }>;

export type CompileResult = Readonly<{
  rule: CompiledRule;
  findings: readonly Finding[];
  diagnostics: readonly Diagnostic[];
}>;

// ---------------------------------------------------------------------------
// Opaque runtime objects (var references) travel through the pipeline as
// sentinels, exactly like the Babel plugin's expressions.
// ---------------------------------------------------------------------------

const CONDITION_KEY = /^(default$|:|@)/;

function isOpaqueObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && !keys.every((k) => CONDITION_KEY.test(k));
}

function substitute(value: unknown, opaque: unknown[]): Value {
  if (isOpaqueObject(value)) {
    opaque.push(value);
    return makeSentinel(opaque.length - 1);
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, Value> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substitute(v, opaque);
    return out;
  }
  return value as Value;
}

function restoreLeaf(value: CompiledLeaf, opaque: readonly unknown[]): CompiledLeaf {
  if (isSentinel(value)) {
    const original = opaque[sentinelIndex(value)];
    return original === undefined ? value : (original as CompiledLeaf);
  }
  return value;
}

function restore(rule: CompiledRule, opaque: readonly unknown[]): CompiledRule {
  if (opaque.length === 0) return rule;
  const record = (r: Readonly<Record<string, CompiledLeaf>>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, restoreLeaf(v, opaque)]));
  const entries = (list: readonly CompiledEntry[]) =>
    list.map((e) => ({ ...e, value: restoreLeaf(e.value, opaque) }));
  return {
    ...rule,
    static: record(rule.static),
    conditional: entries(rule.conditional),
    props: record(rule.props),
    conditionalProps: entries(rule.conditionalProps),
  };
}

// ---------------------------------------------------------------------------

/** Remove the leaf at `chain` from a value; returns the pruned value or undefined if nothing is left. */
function prune(value: Value, chain: readonly string[]): Value | undefined {
  if (chain.length === 0) return undefined;
  if (!isConditional(value)) return value;
  const [head, ...rest] = chain as [string, ...string[]];
  const branch = value[head];
  if (branch === undefined) return value;
  const pruned = prune(branch, rest);
  const next: Record<string, Value> = { ...value };
  if (pruned === undefined) delete next[head];
  else next[head] = pruned;
  return Object.keys(next).length ? next : undefined;
}

/** Drop declarations (or branches) that must not reach native. */
function strip(
  style: Readonly<Record<string, Value>>,
  findings: readonly Finding[],
  strict: boolean,
): Record<string, Value> {
  const out: Record<string, Value> = { ...style };
  for (const f of findings) {
    const remove = f.status === "web-only" || (f.status === "unsupported" && !strict);
    if (!remove) continue;
    const current = out[f.property];
    if (current === undefined) continue;
    const pruned = prune(current, f.conditions);
    if (pruned === undefined) delete out[f.property];
    else out[f.property] = pruned;
  }
  return out;
}

function flatten(
  key: string,
  value: LoweredValue,
  when: readonly string[],
  staticOut: Record<string, CompiledLeaf>,
  conditionalOut: CompiledEntry[],
): void {
  if (!isLoweredConditional(value)) {
    if (when.length === 0) staticOut[key] = value;
    else conditionalOut.push({ key, when, value });
    return;
  }
  for (const [condition, branch] of Object.entries(value)) {
    flatten(
      key,
      branch,
      condition === "default" ? when : [...when, condition],
      staticOut,
      conditionalOut,
    );
  }
}

function containsRuntimeValue(value: LoweredValue): boolean {
  if (typeof value === "string") return value.includes("var(") || isSentinel(value);
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).some((v) => containsRuntimeValue(v as LoweredValue));
}

/**
 * Compile one `stylex.create` rule: expand -> check -> strip -> lower ->
 * flatten. Pure; the Babel plugin turns the result into an AST and applies
 * the error/warning policy to `findings` and `diagnostics`. Called at
 * runtime for rules the plugin did not see.
 */
export function compileRule(
  declarations: Declarations,
  options: CompileOptions = {},
): CompileResult {
  const opaque: unknown[] = [];
  const input: Declarations = Object.fromEntries(
    Object.entries(declarations).map(([k, v]) => [k, substitute(v, opaque)]),
  );

  const expanded = expandDeclarations(input);
  const findings = checkDeclarations(expanded.style, options);
  const stripped = strip(expanded.style, findings, options.strict ?? false);
  const lowered = lowerDeclarations({ style: stripped, depth: expanded.depth });

  const staticStyle: Record<string, CompiledLeaf> = {};
  const conditional: CompiledEntry[] = [];
  const props: Record<string, CompiledLeaf> = {};
  const conditionalProps: CompiledEntry[] = [];
  for (const [k, v] of Object.entries(lowered.style)) flatten(k, v, [], staticStyle, conditional);
  for (const [k, v] of Object.entries(lowered.props)) flatten(k, v, [], props, conditionalProps);

  const usesVars =
    Object.values(lowered.style).some(containsRuntimeValue) ||
    Object.values(lowered.props).some(containsRuntimeValue);

  const rule: CompiledRule = {
    $$stylexn: 1,
    static: staticStyle,
    conditional,
    props,
    conditionalProps,
    depth: Object.fromEntries(Object.entries(lowered.depth).filter(([, d]) => d > 0)),
    usesVars,
  };
  return {
    rule: restore(rule, opaque),
    findings,
    diagnostics: [...expanded.diagnostics, ...lowered.diagnostics],
  };
}

export { isBlocking };
