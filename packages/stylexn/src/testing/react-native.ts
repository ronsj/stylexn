/**
 * A `react-native` stand-in for unit tests that run in jsdom (Vitest or
 * Jest): the primitives render DOM elements that expose their `style` and
 * remaining props as JSON attributes, and the environment modules
 * (Dimensions, Appearance, Platform, ...) are controllable through
 * `testEnv`. Alias `react-native` to `stylexn/testing/react-native` in the
 * test runner's config; StyleXN's own tests use it the same way.
 */
import { createElement, isValidElement, type ComponentType, type ReactNode, type Ref } from "react";
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
export const Switch = host("rn-switch");

type ListSlot = ComponentType<Record<string, never>> | ReactNode;
type FlatListProps<T> = {
  data: readonly T[];
  renderItem: (info: { item: T; index: number }) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: ListSlot;
  ListFooterComponent?: ListSlot;
  ListEmptyComponent?: ListSlot;
  ItemSeparatorComponent?: ListSlot;
  style?: unknown;
  contentContainerStyle?: unknown;
  testID?: string;
  ref?: Ref<unknown>;
  onScroll?: (event: { nativeEvent: { contentOffset: { x: number; y: number } } }) => void;
  [prop: string]: unknown;
};

const slot = (value: ListSlot): ReactNode =>
  typeof value === "function"
    ? createElement(value as ComponentType<Record<string, never>>)
    : isValidElement(value)
      ? value
      : (value as ReactNode);

/**
 * FlatList double: renders every item (no virtualisation) inside an
 * `rn-flatlist` host that exposes its style and props like the others,
 * with the header, separators, footer and empty slot in React Native's order.
 */
export function FlatList<T>({
  data,
  renderItem,
  keyExtractor,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  ItemSeparatorComponent,
  style,
  contentContainerStyle,
  testID,
  ref,
  onScroll,
  ...rest
}: FlatListProps<T>) {
  const serialisable = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => typeof v !== "function"),
  );
  const cells: ReactNode[] = [];
  data.forEach((item, index) => {
    const key = keyExtractor ? keyExtractor(item, index) : String(index);
    if (index > 0 && ItemSeparatorComponent) {
      cells.push(
        createElement("rn-separator", { key: `${key}:sep` }, slot(ItemSeparatorComponent)),
      );
    }
    cells.push(createElement("rn-cell", { key }, renderItem({ item, index })));
  });
  return createElement(
    "rn-flatlist",
    {
      ref,
      "data-testid": testID,
      "data-style": JSON.stringify(style ?? null),
      "data-props": JSON.stringify({ ...serialisable, contentContainerStyle }),
      onScroll:
        onScroll &&
        ((event: { currentTarget: { scrollLeft: number; scrollTop: number } }) =>
          onScroll({
            nativeEvent: {
              contentOffset: {
                x: event.currentTarget.scrollLeft,
                y: event.currentTarget.scrollTop,
              },
            },
          })),
    },
    ListHeaderComponent === undefined ? null : slot(ListHeaderComponent),
    data.length === 0 && ListEmptyComponent !== undefined ? slot(ListEmptyComponent) : cells,
    ListFooterComponent === undefined ? null : slot(ListFooterComponent),
  );
}

/** Read a host element's style / props back from the DOM. */
export const styleOf = (element: { getAttribute(name: string): string | null }) =>
  JSON.parse(element.getAttribute("data-style") ?? "null") as Record<string, unknown>;
export const propsOf = (element: { getAttribute(name: string): string | null }) =>
  JSON.parse(element.getAttribute("data-props") ?? "null") as Record<string, unknown>;
