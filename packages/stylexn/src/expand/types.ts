/** A single style value as written in `stylex.create`. `null` unsets. */
export type Leaf = string | number | null;

/**
 * A conditional value: `{ default: 'a', ':hover': 'b', '@media (...)': { ... } }`.
 * Keys are `default`, pseudo-classes, pseudo-elements or at-rules; nesting
 * is allowed under at-rules.
 */
export type ConditionalValue = { readonly [condition: string]: Value };

export type Value = Leaf | ConditionalValue;

/** A style rule's declarations, keyed by camelCase CSS property. */
export type Declarations = Readonly<Record<string, Value>>;

export function isConditional(value: Value): value is ConditionalValue {
  return typeof value === "object" && value !== null;
}

/** Something the expander could not do; the property is left as written. */
export type Diagnostic = Readonly<{
  property: string;
  value: Leaf;
  message: string;
}>;

/**
 * Expanded declarations: only longhands remain, each tagged with the depth of
 * the shorthand it came from (0 = written as a longhand). Depth is what the
 * merge uses for property-specificity resolution.
 */
export type Expanded = Readonly<{
  style: Readonly<Record<string, Value>>;
  depth: Readonly<Record<string, number>>;
}>;
