import type { SupportedPseudoClass } from "../types/index.ts";
import type { Marker } from "./types.ts";

let markerCounter = 0;

/**
 * `stylex.defineMarker`: a marker for `when.ancestor(pseudo, marker)`. `id`
 * is injected by stylexn/babel (a hash of file and export name, like
 * `defineVars`), so it survives Fast Refresh; without the plugin a
 * process-level counter names it.
 */
export function defineMarker(id?: string): Marker {
  return { $$stylexnMarker: id ?? `m${++markerCounter}` };
}

const DEFAULT_MARKER: Marker = { $$stylexnMarker: "default-marker" };

/** `stylex.defaultMarker`: the shared marker `when.*` uses when none is given. */
export function defaultMarker(): Marker {
  return DEFAULT_MARKER;
}

/** A pseudo-class or attribute selector, as StyleX's `when.*` accept. */
type Pseudo = `:${string}` | `[${string}]`;

/**
 * Relational conditions. Each returns the condition key
 * `:where-<kind>(<pseudo>, <marker id>)`, which the runtime evaluates (only
 * `ancestor`; the others need selectors React Native does not have and are
 * reported by the compat check). `ancestor` takes the pseudo-classes the
 * runtime can evaluate.
 */
export const when = {
  ancestor: <const P extends SupportedPseudoClass>(pseudo: P, marker?: Marker) =>
    key("ancestor", pseudo, marker) as `:where-ancestor(${P}, ${string})`,
  descendant: <const P extends Pseudo>(pseudo: P, marker?: Marker) =>
    key("descendant", pseudo, marker) as `:where-descendant(${P}, ${string})`,
  siblingBefore: <const P extends Pseudo>(pseudo: P, marker?: Marker) =>
    key("sibling-before", pseudo, marker) as `:where-sibling-before(${P}, ${string})`,
  siblingAfter: <const P extends Pseudo>(pseudo: P, marker?: Marker) =>
    key("sibling-after", pseudo, marker) as `:where-sibling-after(${P}, ${string})`,
  anySibling: <const P extends Pseudo>(pseudo: P, marker?: Marker) =>
    key("any-sibling", pseudo, marker) as `:where-any-sibling(${P}, ${string})`,
};

function key(kind: string, pseudo: string, marker: Marker | undefined): string {
  return `:where-${kind}(${pseudo}, ${(marker ?? DEFAULT_MARKER).$$stylexnMarker})`;
}
