export { expandDeclarations, isShorthand, longhandsOf, shorthandDepth } from "./expand.ts";
export { mergeExpanded } from "./merge.ts";
export type { StyleResolution } from "./merge.ts";
export { splitComma, splitSlash, splitSpace } from "./tokenize.ts";
export type { ConditionalValue, Declarations, Diagnostic, Expanded, Leaf, Value } from "./types.ts";
export { isConditional } from "./types.ts";
