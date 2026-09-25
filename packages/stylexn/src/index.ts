// StyleXN: StyleX authoring API -> React Native output.
//
// The compatibility table is the central module; every enforcement layer
// (types, lint, Babel plugin, runtime) reads it. Shorthand expansion and the
// specificity-aware merge are the first pieces of the compile step. See
// STYLEX_RN_HANDOFF.md.

export * from "./compat/index.ts";
export * from "./expand/index.ts";
