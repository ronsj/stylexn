/**
 * Placeholders for values that are not literals at compile time: references
 * to `defineVars` results, dynamic-style parameters, arbitrary expressions.
 * They travel through expand/check/lower as opaque single-token strings and
 * are swapped back for the original expression when code is emitted.
 */
const PREFIX = "\u0000stylexn:expr:";

export function makeSentinel(index: number): string {
  return `${PREFIX}${index}`;
}

export function isSentinel(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function sentinelIndex(value: string): number {
  return Number(value.slice(PREFIX.length));
}
