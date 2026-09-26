import { Appearance, Dimensions, Platform } from "react-native";
import type { Env, InteractionState, VarScope, WindowMetrics } from "./types.ts";

/** Global defaults; `configure()` changes them for the whole app. */
export const config = {
  /** Pixel size of 1rem. */
  rootFontSize: 16,
  /** Font size assumed for `em` when neither the element nor a provider sets one. */
  fontSize: 14,
  /** Input capabilities assumed for `hover`/`pointer` media features. */
  pointer: "coarse" as Env["pointer"],
};

export function configure(overrides: Partial<typeof config>): void {
  Object.assign(config, overrides);
}

let reducedMotion = false;

/** Cached by the hooks module (AccessibilityInfo is async). */
export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
}

export function getReducedMotion(): boolean {
  return reducedMotion;
}

export function windowMetrics(): WindowMetrics {
  const { width, height, scale, fontScale } = Dimensions.get("window");
  return { width, height, scale, fontScale };
}

export function colorScheme(): Env["colorScheme"] {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

/** A one-off snapshot of the environment, for hook-free `props()`. */
export function snapshotEnv(
  overrides: Partial<Env> & { interaction?: InteractionState; vars?: VarScope } = {},
): Env {
  return {
    window: windowMetrics(),
    colorScheme: colorScheme(),
    reducedMotion,
    pointer: config.pointer,
    interaction: {},
    vars: {},
    rootFontSize: config.rootFontSize,
    fontSize: config.fontSize,
    platform: Platform.OS === "android" ? "android" : "ios",
    ...overrides,
  };
}
