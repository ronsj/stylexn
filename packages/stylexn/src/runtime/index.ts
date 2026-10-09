// The StyleX API on React Native. Metro resolves `stylexn` here through the
// `react-native` export condition; alias `@stylexjs/stylex` to `stylexn/native`
// so shared code can keep importing StyleX by its own name.

export { attrs, create, firstThatWorks, keyframes, native, props, web } from "./api.ts";
export type { Props } from "./api.ts";
export { createTheme, defineConsts, defineVars } from "./vars.ts";
export { defaultMarker, defineMarker, when } from "./markers.ts";
export type { VarGroup } from "./vars.ts";
export { config, configure } from "./env.ts";
export {
  FontSizeProvider,
  MarkerProvider,
  TextStyleProvider,
  ThemeProvider,
  useInheritedTextStyle,
  useInteraction,
  useProps,
} from "./hooks.ts";
export type {
  InteractionHandlers,
  Marked,
  MarkerProviderProps,
  TextStyleProviderProps,
  ThemeProviderProps,
  UsePropsOptions,
  UsePropsResult,
} from "./hooks.ts";
export { INHERITED_TEXT_KEYS, splitInherited } from "./inherit.ts";
export type { InheritedTextStyle } from "./inherit.ts";
export { getKeyframes } from "./keyframes.ts";
export type { Keyframe, Keyframes } from "./keyframes.ts";
export { MotionController, useMotion } from "./animated.ts";
export type { AnimatedStyle, MotionEnv } from "./animated.ts";
export { parseMotion, parseTransform } from "./motion.ts";
export type { AnimationSpec, EasingSpec, Motion, Timing, TransitionSpec } from "./motion.ts";
export { analyzeNeeds, resolve } from "./resolve.ts";
export { matchesMedia } from "./media.ts";
export type {
  Ancestors,
  CompiledRule,
  Env,
  InteractionState,
  Marker,
  Needs,
  Resolved,
  RuntimeValue,
  StyleArg,
  Theme,
  VarRef,
  VarScope,
} from "./types.ts";
// StyleX's type names, in their native shapes (see types.ts).
export type {
  CompiledStyles,
  CSSProperties,
  InlineStyles,
  MapNamespaces,
  StaticStyles,
  StaticStylesWithout,
  StyleXArray,
  StyleXStyles,
  StyleXStylesWithout,
  StyleXVar,
} from "./types.ts";

import * as api from "./api.ts";
import * as markers from "./markers.ts";
import * as vars from "./vars.ts";

/** Default export for `import stylex from "@stylexjs/stylex"`. */
const stylex = {
  create: api.create,
  props: api.props,
  attrs: api.attrs,
  firstThatWorks: api.firstThatWorks,
  keyframes: api.keyframes,
  web: api.web,
  native: api.native,
  defineVars: vars.defineVars,
  defineConsts: vars.defineConsts,
  createTheme: vars.createTheme,
  defineMarker: markers.defineMarker,
  defaultMarker: markers.defaultMarker,
  when: markers.when,
};
export default stylex;
