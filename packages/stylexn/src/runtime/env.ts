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
  /** Drive opacity/transform-only motion on the native thread (Animated's native driver). */
  nativeDriver: true,
};

export function configure(overrides: Partial<typeof config>): void {
  Object.assign(config, overrides);
}

/** The accessibility settings `@media` reads; one object so one store slot serves all four. */
export type Accessibility = Readonly<
  Pick<Env, "reducedMotion" | "contrast" | "reducedTransparency" | "invertedColors">
>;

export const DEFAULT_ACCESSIBILITY: Accessibility = {
  reducedMotion: false,
  contrast: "no-preference",
  reducedTransparency: false,
  invertedColors: false,
};

let accessibility = DEFAULT_ACCESSIBILITY;

/**
 * Cached by the hooks module (AccessibilityInfo is async). The snapshot keeps
 * its identity until a value actually changes, as useSyncExternalStore needs.
 * Returns whether anything changed.
 */
export function setAccessibility(patch: Partial<Accessibility>): boolean {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof Accessibility)[]) {
    if (patch[key] !== accessibility[key]) changed = true;
  }
  if (changed) accessibility = { ...accessibility, ...patch };
  return changed;
}

export function getAccessibility(): Accessibility {
  return accessibility;
}

export function setReducedMotion(value: boolean): void {
  setAccessibility({ reducedMotion: value });
}

/** Back to the defaults (all settings off), for tests. */
export function resetAccessibilityForTesting(): void {
  accessibility = DEFAULT_ACCESSIBILITY;
}

export function windowMetrics(): WindowMetrics {
  const { width, height, scale, fontScale } = Dimensions.get("window");
  return { width, height, scale, fontScale };
}

export function platform(): Env["platform"] {
  return Platform.OS === "android" ? "android" : "ios";
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
    ...accessibility,
    pointer: config.pointer,
    interaction: {},
    vars: {},
    rootFontSize: config.rootFontSize,
    fontSize: config.fontSize,
    platform: platform(),
    ...overrides,
  };
}
