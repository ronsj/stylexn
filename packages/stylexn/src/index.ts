// StyleXN: StyleX authoring API -> React Native output.
//
// The compatibility table is the central module; every enforcement layer
// (types, lint, Babel plugin, runtime) reads it. The compile step is
// expand (shorthands -> longhands) -> merge (specificity-aware) ->
// lower (React Native keys and derived props) -> finalize (post-merge
// collapses). See STYLEX_RN_HANDOFF.md.

export * from "./compat/index.ts";
export * from "./expand/index.ts";
export * from "./lower/index.ts";
