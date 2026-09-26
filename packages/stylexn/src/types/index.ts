/**
 * Layer 1: compile-time (editor) checking of `stylex.create` rules, derived
 * from the compat table's literal types. Used to narrow `create()` in both
 * the web entry (StyleX) and the native runtime, so shared code gets the
 * same red squiggles regardless of which platform the editor resolves.
 *
 * The pattern is `create<const S>(styles: S & ValidateStyles<S>)`: for valid
 * input the validation type equals the input and the intersection is the
 * identity; offending leaves become a branded error type whose name carries
 * the message.
 */
import type { StyleXVar } from "@stylexjs/stylex";
import type { atRules, properties, pseudoClasses, pseudoElements } from "../compat/table.ts";

type P = typeof properties;
type PC = typeof pseudoClasses;
type PE = typeof pseudoElements;
type AR = typeof atRules;

/**
 * An object brand rather than a string literal: a literal would make the
 * intersection with the authored value collapse to `never`, and TypeScript
 * would then report the error on the first property of the object instead
 * of the offending one.
 */
type Message<T extends string> = { readonly __stylexnError: `StyleXN: ${T}` };

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

/** Properties with no reasonable native behavior; a type error in create(). */
export type UnsupportedProperty = {
  [K in keyof P]: P[K]["status"] extends "unsupported" ? K : never;
}[keyof P];

/** Properties accepted on native (supported, polyfilled, partial, or web-only). */
export type NativeProperty = Exclude<keyof P, UnsupportedProperty | "--*">;

type ValuesOf<K extends keyof P> = P[K] extends {
  readonly values: infer V extends readonly string[];
}
  ? V[number]
  : never;
type Keywords<K extends keyof P> = Exclude<ValuesOf<K>, `<${string}>`>;
type Patterns<K extends keyof P> = Extract<ValuesOf<K>, `<${string}>`>;

/** Numbers are fine when the entry accepts lengths, percentages or numbers. */
type AllowsNumber<K extends keyof P> = [
  Extract<Patterns<K>, "<number>" | "<length>" | "<percentage>">,
] extends [never]
  ? false
  : true;

/** Any `<pattern>` means free-form strings are possible; the build check judges them. */
type AllowsString<K extends keyof P> = [Patterns<K>] extends [never] ? false : true;

// ---------------------------------------------------------------------------
// Escape hatches: values inside web({ }) / native({ }) blocks are branded so
// the rule-level check leaves them alone (native blocks are validated by
// ValidateNative when the helper is called).
// ---------------------------------------------------------------------------

declare const WEB: unique symbol;
declare const NATIVE: unique symbol;
export type Web<V> = V & { readonly [WEB]: true };
export type Native<V> = V & { readonly [NATIVE]: true };
type Branded = { readonly [WEB]: true } | { readonly [NATIVE]: true };

/** A var reference: StyleX's branded string on web, StyleXN's object on native. */
type VarLike = { readonly $$stylexnVar: string } | StyleXVar<unknown>;

type LeafOk<K extends keyof P, V> = [ValuesOf<K>] extends [never]
  ? true
  : V extends Keywords<K>
    ? true
    : V extends number
      ? AllowsNumber<K>
      : V extends string
        ? AllowsString<K>
        : false;

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** Pseudo-classes the runtime can evaluate (web-only ones are allowed and ignored). */
export type SupportedPseudoClass = {
  [K in keyof PC]: PC[K]["status"] extends "unsupported" ? never : K;
}[keyof PC];

/** Pseudo-elements allowed on property `K` (`::placeholder` only on the properties its entry lists). */
type SupportedPseudoElement<K> = {
  [E in keyof PE]: PE[E]["status"] extends "unsupported"
    ? never
    : PE[E] extends { readonly values: infer V extends readonly string[] }
      ? K extends V[number]
        ? E
        : never
      : E;
}[keyof PE];

/** At-rules with any query text, minus the unsupported ones (`@container`). */
export type SupportedAtRule = {
  [A in keyof AR]: AR[A]["status"] extends "unsupported" ? never : `${A & string}${string}`;
}[keyof AR];

type CheckCondition<K extends keyof P & string, C, V> = C extends "default"
  ? CheckValue<K, V>
  : C extends SupportedPseudoClass | SupportedPseudoElement<K> | SupportedAtRule
    ? CheckValue<K, V>
    : Message<`condition "${C & string}" is not supported on React Native for ${K}`>;

type CheckConditional<K extends keyof P & string, V> = {
  readonly [C in keyof V]: CheckCondition<K, C, V[C]>;
};

// ---------------------------------------------------------------------------
// Values and rules
// ---------------------------------------------------------------------------

export type CheckValue<K extends keyof P & string, V> = V extends null | undefined
  ? V
  : V extends Branded
    ? V
    : V extends VarLike
      ? V
      : V extends string | number
        ? LeafOk<K, V> extends true
          ? V
          : Message<`"${V & (string | number)}" is not a supported ${K} value on React Native`>
        : V extends readonly unknown[]
          ? Message<`arrays are not style values (${K})`>
          : V extends object
            ? CheckConditional<K, V>
            : Message<`unsupported ${K} value`>;

export type CheckRule<R> = R extends { readonly $$stylexn: 1 }
  ? R // already compiled by the Babel plugin
  : {
      readonly [K in keyof R]: NonNullable<R[K]> extends Branded
        ? R[K] // from a web({ }) / native({ }) block
        : K extends NativeProperty
          ? CheckValue<K, R[K]>
          : K extends UnsupportedProperty
            ? Message<`${K} is not supported on React Native`>
            : K extends `--${string}`
              ? R[K]
              : Message<`unknown property ${K & string}`>;
    };

/**
 * Validation for a native({ }) block: unsupported properties still error,
 * known ones are checked, and React Native-only keys (elevation, shadow*)
 * are allowed as written.
 */
export type ValidateNative<R> = {
  readonly [K in keyof R]: K extends UnsupportedProperty
    ? Message<`${K} is not supported on React Native`>
    : K extends NativeProperty
      ? CheckValue<K, R[K]>
      : R[K];
};

/**
 * Validation type for a whole `create()` argument. Dynamic rules are checked
 * on their returned object.
 */
export type ValidateStyles<S> = {
  readonly [Name in keyof S]: S[Name] extends (...args: infer A) => infer R
    ? (...args: A) => CheckRule<R>
    : CheckRule<S[Name]>;
};
