/**
 * A `react-native` stand-in for unit tests that run in jsdom (Vitest or
 * Jest): the primitives render DOM elements that expose their `style` and
 * remaining props as JSON attributes, and the environment modules
 * (Dimensions, Appearance, Platform, ...) are controllable through
 * `testEnv`. Alias `react-native` to `stylexn/testing/react-native` in the
 * test runner's config; StyleXN's own tests use it the same way.
 */
import { resetFakeAnimated } from "../runtime/fake-animated.ts";
import { host } from "./host.ts";

export {
  Animated,
  Easing,
  resetFakeAnimated,
  started as startedAnimations,
} from "../runtime/fake-animated.ts";

type Listener = (...args: never[]) => void;

/** Mutable environment the mocked modules read; reset it between tests. */
export const testEnv = {
  window: { width: 390, height: 844, scale: 3, fontScale: 1 },
  colorScheme: "light" as "light" | "dark",
  reduceMotion: false,
  platform: "ios" as "ios" | "android",
  listeners: { dimensions: new Set<Listener>(), appearance: new Set<Listener>() },
};

export function resetTestEnv(): void {
  testEnv.window = { width: 390, height: 844, scale: 3, fontScale: 1 };
  testEnv.colorScheme = "light";
  testEnv.reduceMotion = false;
  testEnv.platform = "ios";
  testEnv.listeners.dimensions.clear();
  testEnv.listeners.appearance.clear();
  resetFakeAnimated();
}

/** Simulate a rotation/resize or a colour-scheme change. */
export function setWindow(window: Partial<typeof testEnv.window>): void {
  Object.assign(testEnv.window, window);
  for (const cb of testEnv.listeners.dimensions) cb();
}
export function setColorScheme(scheme: "light" | "dark"): void {
  testEnv.colorScheme = scheme;
  for (const cb of testEnv.listeners.appearance) cb();
}

export const Dimensions = {
  get: () => testEnv.window,
  addEventListener: (_: string, cb: Listener) => {
    testEnv.listeners.dimensions.add(cb);
    return { remove: () => testEnv.listeners.dimensions.delete(cb) };
  },
};
export const Appearance = {
  getColorScheme: () => testEnv.colorScheme,
  addChangeListener: (cb: Listener) => {
    testEnv.listeners.appearance.add(cb);
    return { remove: () => testEnv.listeners.appearance.delete(cb) };
  },
};
export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(testEnv.reduceMotion),
  addEventListener: () => ({ remove() {} }),
};
export const Platform = {
  get OS() {
    return testEnv.platform;
  },
  select: <T>(spec: Record<string, T>) => spec[testEnv.platform] ?? spec.default,
};
export const StyleSheet = { create: <T>(styles: T) => styles, flatten: (s: unknown) => s };

export const View = host("rn-view");
export const Text = host("rn-text");
export const Pressable = host("rn-pressable");
export const Image = host("rn-image");
// A real <input>, so Testing Library can fire change events with a value.
export const TextInput = host("input");
export const ScrollView = host("rn-scrollview");

/** Read a host element's style / props back from the DOM. */
export const styleOf = (element: { getAttribute(name: string): string | null }) =>
  JSON.parse(element.getAttribute("data-style") ?? "null") as Record<string, unknown>;
export const propsOf = (element: { getAttribute(name: string): string | null }) =>
  JSON.parse(element.getAttribute("data-props") ?? "null") as Record<string, unknown>;
