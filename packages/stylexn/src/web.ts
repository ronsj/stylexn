// On web `stylexn` is StyleX itself: the real compiler handles it (configure
// `importSources: ["stylexn"]` in @stylexjs/babel-plugin). Native resolves
// the `react-native` export condition to the StyleXN runtime instead.
//
// `create` is StyleX's function with its input type narrowed by the compat
// table (Layer 1), so unsupported native styles are editor errors even when
// the editor resolves the web entry.
import * as stylex from "@stylexjs/stylex";
import type { MapNamespaces } from "@stylexjs/stylex";
import type { ValidateStyles } from "./types/index.ts";

export * from "@stylexjs/stylex";

type StyleXInput = Parameters<typeof stylex.create>[0];

export const create: <const S extends StyleXInput>(
  styles: S & ValidateStyles<S>,
) => MapNamespaces<S> = stylex.create as never;
