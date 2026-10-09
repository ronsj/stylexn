import { checkDeclarations, isBlocking } from "../check/check.ts";
import type { CheckOptions, Finding } from "../check/check.ts";
import { expandDeclarations } from "../expand/expand.ts";
import type { Declarations, Diagnostic, Leaf, Value } from "../expand/types.ts";
import { isConditional } from "../expand/types.ts";
import {
  describeFirstThatWorks,
  isFirstThatWorks,
  makeFirstThatWorks,
} from "../first-that-works.ts";
import type { AuthoredDeclarations, AuthoredValue } from "../first-that-works.ts";
import { lowerDeclarations } from "../lower/lower.ts";
import type { LoweredValue, RNLeaf } from "../lower/lower.ts";
import { isLoweredConditional } from "../lower/lower.ts";
import { propertyEntries } from "../compat/table.ts";
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
    /** Authored properties from native({ }) blocks: never reported or stripped. */
    trusted?: ReadonlySet<string>;
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
  if (isFirstThatWorks(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && !keys.every((k) => CONDITION_KEY.test(k));
}

function substitute(value: unknown, opaque: unknown[]): AuthoredValue {
  if (isFirstThatWorks(value)) {
    // Each candidate may be a var reference on the uncompiled runtime path.
    return makeFirstThatWorks(
      value.$$stylexnFirstThatWorks.map((c) => substitute(c, opaque) as Leaf),
    );
  }
  if (isOpaqueObject(value)) {
    opaque.push(value);
    return makeSentinel(opaque.length - 1);
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, AuthoredValue> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substitute(v, opaque);
    return out;
  }
  return value as Leaf;
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

/**
 * Whether a finding is exempt because its property was authored inside a
 * native({ }) block. Exemption covers React Native-only keys and value/unit/
 * condition checks; a property the table lists as unsupported stays an error.
 */
export function isExempt(
  finding: Finding,
  origin: Readonly<Record<string, string>>,
  trusted: ReadonlySet<string> | undefined,
): boolean {
  if (!trusted || trusted.size === 0) return false;
  const authored = trusted.has(finding.property) || trusted.has(origin[finding.property] ?? "");
  if (!authored) return false;
  const listedUnsupported =
    finding.kind === "property" &&
    finding.status === "unsupported" &&
    propertyEntries[finding.property] !== undefined;
  return !listedUnsupported;
}

// ---------------------------------------------------------------------------
// firstThatWorks: pick the first candidate React Native accepts
// ---------------------------------------------------------------------------

/**
 * Whether React Native takes `candidate` for `property`: no value, unit or
 * function finding that would block or strip it. Property-level findings
 * (unsupported property, React Native version) do not depend on the
 * candidate, so they are left to the rule's own check. Unset and runtime
 * values (sentinels) cannot be judged here and are accepted.
 */
function acceptsCandidate(
  property: string,
  candidate: Leaf,
  options: CheckOptions,
  trusted: ReadonlySet<string> | undefined,
): boolean {
  if (candidate === null || isSentinel(candidate)) return true;
  const expanded = expandDeclarations({ [property]: candidate });
  if (expanded.diagnostics.length) return false;
  return !checkDeclarations(expanded.style, options).some(
    (f) =>
      f.kind !== "property" &&
      f.kind !== "version" &&
      (isBlocking(f) || f.status === "web-only") &&
      !isExempt(f, expanded.origin, trusted),
  );
}

/**
 * Replace every `firstThatWorks(...)` value with its first candidate the
 * compat check accepts (StyleX on the web lists them all and the browser
 * keeps the last it understands; authors put the preferred value first).
 * When none is accepted, the declaration or branch is dropped and one
 * finding names all candidates. Shared by the compiler and the lint core.
 */
export function resolveFirstThatWorks(
  declarations: AuthoredDeclarations,
  options: CheckOptions = {},
  trusted?: ReadonlySet<string>,
): { declarations: Declarations; findings: Finding[] } {
  const findings: Finding[] = [];
  const resolveValue = (
    property: string,
    value: AuthoredValue,
    conditions: readonly string[],
  ): Value | undefined => {
    if (isFirstThatWorks(value)) {
      const candidates = value.$$stylexnFirstThatWorks;
      const chosen = candidates.find((c) => acceptsCandidate(property, c, options, trusted));
      if (chosen !== undefined) return chosen;
      const shown = describeFirstThatWorks(candidates);
      findings.push({
        kind: "function",
        status: "unsupported",
        property,
        conditions,
        value: shown,
        message: `${property}: none of ${shown} is supported on React Native`,
      });
      return undefined;
    }
    if (typeof value !== "object" || value === null) return value;
    const out: Record<string, Value> = {};
    for (const [condition, branch] of Object.entries(value)) {
      const resolved = resolveValue(property, branch, [...conditions, condition]);
      if (resolved !== undefined) out[condition] = resolved;
    }
    return Object.keys(out).length ? out : undefined;
  };

  const out: Record<string, Value> = {};
  for (const [property, value] of Object.entries(declarations)) {
    const resolved = resolveValue(property, value, []);
    if (resolved !== undefined) out[property] = resolved;
  }
  return { declarations: out, findings };
}

/** Marks a value authored in native({ }) on the uncompiled runtime path. */
export class NativeValue {
  readonly value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}

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
    const remove = f.status === "web-only" || (isBlocking(f) && !strict);
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
 * Compile one `stylex.create` rule: resolve firstThatWorks -> expand ->
 * check -> strip -> lower -> flatten. Pure; the Babel plugin turns the
 * result into an AST and applies the error/warning policy to `findings` and
 * `diagnostics`. Called at runtime for rules the plugin did not see.
 */
export function compileRule(
  declarations: AuthoredDeclarations,
  options: CompileOptions = {},
): CompileResult {
  const opaque: unknown[] = [];
  const trusted = new Set(options.trusted ?? []);
  const input: AuthoredDeclarations = Object.fromEntries(
    Object.entries(declarations).map(([k, v]) => {
      if (v instanceof NativeValue) {
        trusted.add(k);
        return [k, substitute(v.value, opaque)];
      }
      return [k, substitute(v, opaque)];
    }),
  );

  const resolved = resolveFirstThatWorks(input, options, trusted);
  const expanded = expandDeclarations(resolved.declarations);
  const checked = checkDeclarations(expanded.style, options).filter(
    (f) => !isExempt(f, expanded.origin, trusted),
  );
  // A firstThatWorks with no accepted candidate is already gone from the input.
  const findings = [...resolved.findings, ...checked];
  const stripped = strip(expanded.style, checked, options.strict ?? false);
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
