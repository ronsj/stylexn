import { createElement, useMemo, type ReactNode } from "react";
import { ENV_GROUP } from "../lower/env-function.ts";
import { ThemeProvider } from "./hooks.ts";
import { createTheme, defineBuiltinVars } from "./vars.ts";

/**
 * The variables behind `env(safe-area-inset-*)`: the compiler rewrites
 * `env(safe-area-inset-top)` to `var(--stylexn-env.safeAreaInsetTop)`
 * (lower/env-function.ts). The defaults are 0, what a browser reports on a
 * rectangular screen, so without a provider the insets are 0 and an
 * `env()` fallback is not used, as on the web.
 */
const safeArea = defineBuiltinVars(
  { safeAreaInsetTop: 0, safeAreaInsetRight: 0, safeAreaInsetBottom: 0, safeAreaInsetLeft: 0 },
  ENV_GROUP,
);

export type SafeAreaInsets = Readonly<{ top: number; right: number; bottom: number; left: number }>;

export type SafeAreaInsetsProviderProps = Readonly<{
  /** The subtree's safe-area insets, e.g. `useSafeAreaInsets()` from react-native-safe-area-context. */
  insets: SafeAreaInsets;
  children?: ReactNode;
}>;

/**
 * Supply the values of `env(safe-area-inset-*)` to a subtree. StyleXN does
 * not measure insets itself; pass them from react-native-safe-area-context:
 * `<SafeAreaInsetsProvider insets={useSafeAreaInsets()}>`. On the web the
 * browser provides `env()` and this renders its children unchanged.
 */
export function SafeAreaInsetsProvider({ insets, children }: SafeAreaInsetsProviderProps) {
  const { top, right, bottom, left } = insets;
  const theme = useMemo(
    () =>
      createTheme(safeArea, {
        safeAreaInsetTop: top,
        safeAreaInsetRight: right,
        safeAreaInsetBottom: bottom,
        safeAreaInsetLeft: left,
      }),
    [top, right, bottom, left],
  );
  return createElement(ThemeProvider, { theme }, children);
}
