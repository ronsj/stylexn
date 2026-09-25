import { checkDeclarations, isBlocking } from "../check/check.ts";
import type { CheckOptions, Finding } from "../check/check.ts";
import { expandDeclarations } from "../expand/expand.ts";
import type { Declarations, Diagnostic, Value } from "../expand/types.ts";
import { isConditional } from "../expand/types.ts";
import { lowerDeclarations } from "../lower/lower.ts";
import type { LoweredValue, RNLeaf } from "../lower/lower.ts";
import { isLoweredConditional } from "../lower/lower.ts";
import { isSentinel } from "../sentinel.ts";

/** One conditional declaration: apply `value` to `key` when every condition in `when` holds. */
export type CompiledEntry = Readonly<{
  key: string;
  when: readonly string[];
  value: RNLeaf;
}>;

export type CompiledRule = Readonly<{
  $$stylexn: 1;
  /** Unconditional React Native style. */
  static: Readonly<Record<string, RNLeaf>>;
  /** Conditional style entries, in declaration order. */
  conditional: readonly CompiledEntry[];
  /** Unconditional component props derived from styles. */
  props: Readonly<Record<string, RNLeaf>>;
  conditionalProps: readonly CompiledEntry[];
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
  staticOut: Record<string, RNLeaf>,
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
 * the error/warning policy to `findings` and `diagnostics`.
 */
export function compileRule(
  declarations: Declarations,
  options: CompileOptions = {},
): CompileResult {
  const expanded = expandDeclarations(declarations);
  const findings = checkDeclarations(expanded.style, options);
  const stripped = strip(expanded.style, findings, options.strict ?? false);
  const lowered = lowerDeclarations({ style: stripped, depth: expanded.depth });

  const staticStyle: Record<string, RNLeaf> = {};
  const conditional: CompiledEntry[] = [];
  const props: Record<string, RNLeaf> = {};
  const conditionalProps: CompiledEntry[] = [];
  for (const [k, v] of Object.entries(lowered.style)) flatten(k, v, [], staticStyle, conditional);
  for (const [k, v] of Object.entries(lowered.props)) flatten(k, v, [], props, conditionalProps);

  const usesVars =
    Object.values(lowered.style).some(containsRuntimeValue) ||
    Object.values(lowered.props).some(containsRuntimeValue);

  return {
    rule: { $$stylexn: 1, static: staticStyle, conditional, props, conditionalProps, usesVars },
    findings,
    diagnostics: [...expanded.diagnostics, ...lowered.diagnostics],
  };
}

export { isBlocking };
