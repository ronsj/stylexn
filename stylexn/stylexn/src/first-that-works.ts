/**
 * `stylex.firstThatWorks(a, b, ...)` on its way from authoring to the
 * compiler: a tagged object listing the candidates in order. The extractor
 * builds it from the call's arguments (non-literal ones become sentinels) and
 * the native runtime's `firstThatWorks` returns it for the uncompiled path.
 * `compileRule` and the lint core replace it with the first candidate the
 * compat check accepts before expansion, so nothing downstream sees the tag.
 *
 * The key is not a condition key (`default`, `:...`, `@...`), so the tag is
 * never mistaken for a conditional value.
 */
import type { Leaf } from "./expand/types.ts";

export const FIRST_THAT_WORKS = "$$stylexnFirstThatWorks";

export type FirstThatWorksValue<C = Leaf> = Readonly<{ [FIRST_THAT_WORKS]: readonly C[] }>;

/** A style value before `firstThatWorks` is resolved: a leaf, a tag, or a conditional of those. */
export type AuthoredValue =
  | Leaf
  | FirstThatWorksValue
  | { readonly [condition: string]: AuthoredValue };

/** A rule's declarations as written, `firstThatWorks` tags included. */
export type AuthoredDeclarations = Readonly<Record<string, AuthoredValue>>;

export function makeFirstThatWorks<C>(candidates: readonly C[]): FirstThatWorksValue<C> {
  return { [FIRST_THAT_WORKS]: candidates };
}

export function isFirstThatWorks(value: unknown): value is FirstThatWorksValue<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>)[FIRST_THAT_WORKS])
  );
}

/** `firstThatWorks("100dvh", "100vh")`, for messages. */
export function describeFirstThatWorks(candidates: readonly Leaf[]): string {
  const shown = candidates.map((c) => (typeof c === "string" ? JSON.stringify(c) : String(c)));
  return `firstThatWorks(${shown.join(", ")})`;
}
