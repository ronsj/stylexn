// On web `stylexn` is StyleX itself: the real compiler handles it (configure
// `importSources: ["stylexn"]` in @stylexjs/babel-plugin). Native resolves
// the `react-native` export condition to the StyleXN runtime instead.
//
// `create` is StyleX's function with its input type narrowed by the compat
// table (Layer 1), so unsupported native styles are editor errors even when
// the editor resolves the web entry.
import * as stylex from "@stylexjs/stylex";
import type { MapNamespaces, Theme, VarGroup } from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import type {
  Native,
  ValidateKeyframes,
  ValidateNative,
  ValidateStyles,
  Web,
} from "./types/index.ts";

export * from "@stylexjs/stylex";

type StyleXInput = Parameters<typeof stylex.create>[0];

/** Escape hatch: web-only styles. Identity on web; the Babel plugin inlines the block for StyleX. */
export function web<const T extends Record<string, unknown>>(
  styles: T,
): { readonly [K in keyof T]?: Web<T[K]> } {
  return styles as unknown as { readonly [K in keyof T]?: Web<T[K]> };
}

/** Escape hatch: native-only styles. Empty on web; the Babel plugin drops the block before StyleX. */
export function native<const T extends Record<string, unknown>>(
  _styles: T & ValidateNative<T>,
): { readonly [K in keyof T]?: Native<T[K]> } {
  return {};
}

export const create: <const S extends StyleXInput>(
  styles: S & ValidateStyles<S>,
) => MapNamespaces<S> = stylex.create as never;

/** StyleX's `keyframes`, with the frames checked like the native entry does. */
export const keyframes: <const T extends Record<string, Record<string, unknown>>>(
  frames: T & ValidateKeyframes<T>,
) => string = stylex.keyframes as never;

type AnyTheme = Theme<VarGroup<Record<string, unknown>>>;

export type ThemeProviderProps = Readonly<{
  theme: AnyTheme | readonly AnyTheme[];
  children?: ReactNode;
}>;

/**
 * Apply `createTheme` overrides to a subtree. On the web a theme is a class
 * that sets custom properties, so this is a `display: contents` wrapper
 * carrying it; the native entry provides the same component over context.
 * The wrapper's own style is inline: this module ships uncompiled, so it
 * cannot use `stylex.create` itself.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const themes = Array.isArray(theme) ? (theme as readonly AnyTheme[]) : [theme as AnyTheme];
  const { className, style } = stylex.props(...themes);
  return createElement("div", { className, style: { ...style, display: "contents" } }, children);
}
