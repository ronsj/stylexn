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

const EMBEDDED = new RegExp(`${PREFIX}(\\d+)`, "g");

/**
 * A string with sentinels embedded in it (a `when.*` condition key whose
 * marker is an expression), split into the text around them and their
 * indices: `strings.length === indices.length + 1`, like a template literal.
 */
export function splitSentinels(text: string): { strings: string[]; indices: number[] } {
  const strings: string[] = [];
  const indices: number[] = [];
  let last = 0;
  for (const m of text.matchAll(EMBEDDED)) {
    strings.push(text.slice(last, m.index));
    indices.push(Number(m[1]));
    last = m.index + m[0].length;
  }
  strings.push(text.slice(last));
  return { strings, indices };
}

/** `text` with each embedded sentinel replaced, for messages. */
export function describeSentinels(text: string, replacement: string): string {
  return text.replace(EMBEDDED, replacement);
}
