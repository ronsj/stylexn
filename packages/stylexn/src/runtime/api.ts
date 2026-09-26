import { compileRule } from "../compile/compile.ts";
import type { CompiledRule } from "../compile/compile.ts";
import type { Declarations } from "../expand/types.ts";
import type { RNLeaf } from "../lower/lower.ts";
import { snapshotEnv } from "./env.ts";
import { resolve } from "./resolve.ts";
import type { StyleArg } from "./types.ts";
import { isCompiledRule } from "./types.ts";

type RuleInput = CompiledRule | Declarations | ((...args: never[]) => CompiledRule | Declarations);

let warnedUncompiled = false;

function ensureCompiled(rule: CompiledRule | Declarations, name: string): CompiledRule {
  if (isCompiledRule(rule)) return rule;
  if (!warnedUncompiled) {
    warnedUncompiled = true;
    console.warn(
      `[stylexn] stylex.create("${name}") was not compiled by stylexn/babel; compiling at runtime. Add the plugin to babel.config.js.`,
    );
  }
  return compileRule(rule as Declarations).rule;
}

/**
 * `stylex.create`. With the Babel plugin the input is already compiled and
 * this is the identity; otherwise rules are compiled here (dev convenience).
 */
export function create<T extends Record<string, RuleInput>>(
  rules: T,
): {
  [K in keyof T]: T[K] extends (...args: infer A) => unknown
    ? (...args: A) => CompiledRule
    : CompiledRule;
} {
  const out: Record<string, unknown> = {};
  for (const [name, rule] of Object.entries(rules)) {
    if (typeof rule === "function") {
      out[name] = (...args: never[]) => ensureCompiled(rule(...args), name);
    } else {
      out[name] = ensureCompiled(rule, name);
    }
  }
  return out as ReturnType<typeof create<T>>;
}

export type Props = Readonly<{ style: Readonly<Record<string, RNLeaf>>; [prop: string]: unknown }>;

/**
 * `stylex.props`: hook-free resolution against a one-off environment
 * snapshot. Interaction conditions never hold here and nothing re-renders on
 * rotation or theme change; use `useProps` inside components for that.
 */
export function props(...args: readonly StyleArg[]): Props {
  const { style, props: extra } = resolve(args, snapshotEnv());
  return { ...extra, style };
}

/** Deprecated StyleX alias of `props`. */
export const attrs = props;

/** `stylex.firstThatWorks`: the compat check picks at compile time; at runtime the first value stands. */
export function firstThatWorks<T>(...values: readonly T[]): T | undefined {
  return values[0];
}

/** `stylex.keyframes`: not implemented on native yet; returns an inert name. */
let keyframeCounter = 0;
export function keyframes(_frames: Record<string, Declarations>): string {
  const name = `stylexn-keyframes-${++keyframeCounter}`;
  console.warn(`[stylexn] keyframes are not implemented on native yet (${name})`);
  return name;
}
