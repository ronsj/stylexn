import { compileRule, NativeValue } from "../compile/compile.ts";
import type { CompiledRule } from "../compile/compile.ts";
import type { Declarations } from "../expand/types.ts";
import type { RNLeaf } from "../lower/lower.ts";
import { snapshotEnv } from "./env.ts";
import { keyframes as registerKeyframes } from "./keyframes.ts";
import { resolve } from "./resolve.ts";
import type { StyleArg } from "./types.ts";
import type { Native, ValidateNative, ValidateStyles, Web } from "../types/index.ts";
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
export function create<const T extends Record<string, RuleInput>>(
  rules: T & ValidateStyles<T>,
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

/**
 * Escape hatch: styles that only apply on web. On native the block is empty,
 * so spreading it into a rule adds nothing (the Babel plugin removes it at
 * build time; this is the uncompiled fallback).
 */
export function web<const T extends Record<string, unknown>>(
  _styles: T,
): { readonly [K in keyof T]?: Web<T[K]> } {
  return {};
}

/**
 * Escape hatch: styles that only apply on native, exempt from the compat
 * check but validated for outright unsupported properties. Identity here.
 */
export function native<const T extends Record<string, unknown>>(
  styles: T & ValidateNative<T>,
): { readonly [K in keyof T]?: Native<T[K]> } {
  // Values are marked so the runtime compiler can trust them like the plugin does.
  return Object.fromEntries(
    Object.entries(styles).map(([k, v]) => [k, new NativeValue(v)]),
  ) as unknown as {
    readonly [K in keyof T]?: Native<T[K]>;
  };
}

/** Deprecated StyleX alias of `props`. */
export const attrs = props;

/** `stylex.firstThatWorks`: the compat check picks at compile time; at runtime the first value stands. */
export function firstThatWorks<T>(...values: readonly T[]): T | undefined {
  return values[0];
}

/**
 * `stylex.keyframes`: frames are compiled (by stylexn/babel, or here) and
 * registered under the returned name for `animationName`.
 */
export function keyframes<const T extends Record<string, Record<string, unknown>>>(
  frames: T & ValidateStyles<T>,
): string {
  return registerKeyframes(frames as Record<string, Declarations | CompiledRule>);
}
