// The StyleX API on React Native. Metro resolves `stylexn` here through the
// `react-native` export condition; alias `@stylexjs/stylex` to `stylexn/native`
// so shared code can keep importing StyleX by its own name.

export { attrs, create, firstThatWorks, keyframes, props } from "./api.ts";
export type { Props } from "./api.ts";
export { createTheme, defineConsts, defineVars } from "./vars.ts";
export type { VarGroup } from "./vars.ts";
export { config, configure } from "./env.ts";
export { FontSizeProvider, ThemeProvider, useInteraction, useProps } from "./hooks.ts";
export type { InteractionHandlers, ThemeProviderProps, UsePropsOptions } from "./hooks.ts";
export { analyzeNeeds, resolve } from "./resolve.ts";
export { matchesMedia } from "./media.ts";
export type {
  CompiledRule,
  Env,
  InteractionState,
  Needs,
  Resolved,
  RuntimeValue,
  StyleArg,
  Theme,
  VarRef,
  VarScope,
} from "./types.ts";

import * as api from "./api.ts";
import * as vars from "./vars.ts";

/** Default export for `import stylex from "@stylexjs/stylex"`. */
const stylex = {
  create: api.create,
  props: api.props,
  attrs: api.attrs,
  firstThatWorks: api.firstThatWorks,
  keyframes: api.keyframes,
  defineVars: vars.defineVars,
  defineConsts: vars.defineConsts,
  createTheme: vars.createTheme,
};
export default stylex;
