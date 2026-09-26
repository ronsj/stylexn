import { propertyEntries as properties, rnOnlyKeys } from "../compat/table.ts";
import { expanders } from "./shorthands.ts";
import type { ConditionalValue, Declarations, Diagnostic, Expanded, Leaf, Value } from "./types.ts";
import { isConditional } from "./types.ts";

/**
 * Depth of a property in the shorthand hierarchy, derived from the compat
 * table: 0 for longhands, 1 for shorthands of longhands (`margin`), 2 for
 * shorthands of shorthands (`border` -> `borderWidth` -> `borderTopWidth`).
 */
export function shorthandDepth(property: string): number {
  const targets = properties[property]?.expandsTo;
  if (!targets || targets.length === 0) return 0;
  let max = 0;
  for (const t of targets) max = Math.max(max, shorthandDepth(t));
  return 1 + max;
}

export function isShorthand(property: string): boolean {
  return property in expanders;
}

type LeafExpansion = Record<string, Leaf>;

/** Expand one leaf fully (shorthands of shorthands recurse). */
function expandLeaf(
  property: string,
  value: Leaf,
  diagnostics: Diagnostic[],
  path: string,
): LeafExpansion | null {
  const expander = expanders[property];
  if (!expander) return null;
  if (value === null) {
    // Unsetting a shorthand unsets every longhand it covers.
    return Object.fromEntries(longhandsOf(property).map((k) => [k, null]));
  }
  const result = expander(value);
  if (typeof result === "string") {
    diagnostics.push({ property: path, value, message: result });
    return null;
  }
  const out: LeafExpansion = {};
  for (const [k, v] of Object.entries(result)) {
    if (k === property) {
      // The expander chose to keep the shorthand (numeric `flex`).
      out[k] = v;
      continue;
    }
    const nested = expandLeaf(k, v, diagnostics, path);
    if (nested) Object.assign(out, nested);
    else out[k] = v;
  }
  return out;
}

/** Every longhand a shorthand ultimately covers, in table order. */
export function longhandsOf(property: string): string[] {
  const targets = properties[property]?.expandsTo;
  if (!targets) return [property];
  const out: string[] = [];
  for (const t of targets) {
    if (t in properties && !rnOnlyKeys.has(t)) out.push(...longhandsOf(t));
    else out.push(t);
  }
  return [...new Set(out)];
}

/**
 * Expand a conditional value by expanding each branch and regrouping the
 * results per longhand, so every longhand ends up with the same condition
 * keys as the original. Branches that fail to expand keep the original
 * property, reported via diagnostics.
 */
function expandConditional(
  property: string,
  value: ConditionalValue,
  diagnostics: Diagnostic[],
  path: string,
): Record<string, ConditionalValue> | null {
  const perLonghand: Record<string, Record<string, Value>> = {};
  for (const [condition, branch] of Object.entries(value)) {
    const branchPath = `${path}[${condition}]`;
    const expanded = isConditional(branch)
      ? expandConditional(property, branch, diagnostics, branchPath)
      : expandLeaf(property, branch, diagnostics, branchPath);
    if (!expanded) return null;
    for (const [k, v] of Object.entries(expanded)) (perLonghand[k] ??= {})[condition] = v;
  }
  return perLonghand;
}

/**
 * Expand every shorthand in a rule to longhands. Values are left untouched
 * apart from splitting; unit normalisation happens later. Properties that
 * cannot be expanded (malformed values, unknown shorthands) are kept as
 * written so the compat check can report them.
 */
export function expandDeclarations(declarations: Declarations): Expanded & {
  diagnostics: readonly Diagnostic[];
} {
  const style: Record<string, Value> = {};
  const depth: Record<string, number> = {};
  const diagnostics: Diagnostic[] = [];

  for (const [property, value] of Object.entries(declarations)) {
    if (!isShorthand(property)) {
      style[property] = value;
      continue;
    }
    const expanded = isConditional(value)
      ? expandConditional(property, value, diagnostics, property)
      : expandLeaf(property, value, diagnostics, property);
    if (!expanded) {
      style[property] = value;
      continue;
    }
    const d = shorthandDepth(property);
    for (const [k, v] of Object.entries(expanded)) {
      style[k] = v;
      if (k !== property && d > 0) depth[k] = d;
    }
  }
  return { style, depth, diagnostics };
}
