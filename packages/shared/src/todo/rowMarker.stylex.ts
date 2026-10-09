import * as stylex from "stylexn";

// The marker each todo row carries, so the row's actions can follow the
// row's hover and press (`stylex.when.ancestor`). Like defineVars, StyleX
// requires defineMarker in a *.stylex.ts file, as a named export.
export const rowMarker = stylex.defineMarker();
