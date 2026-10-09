// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type Listener = (...args: never[]) => void;
const listeners = { dimensions: new Set<Listener>(), appearance: new Set<Listener>() };
const window = { width: 390, height: 844, scale: 3, fontScale: 1 };
let scheme: "light" | "dark" = "light";

vi.mock("react-native", () => ({
  Dimensions: {
    get: () => window,
    addEventListener: (_: string, cb: Listener) => {
      listeners.dimensions.add(cb);
      return { remove: () => listeners.dimensions.delete(cb) };
    },
  },
  Appearance: {
    getColorScheme: () => scheme,
    addChangeListener: (cb: Listener) => {
      listeners.appearance.add(cb);
      return { remove: () => listeners.appearance.delete(cb) };
    },
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(false),
    addEventListener: () => ({ remove: () => {} }),
  },
  Platform: { OS: "ios" },
}));

import { create } from "./api.ts";
import { FontSizeProvider, ThemeProvider, useProps, type UsePropsOptions } from "./hooks.ts";
import { createTheme, defineVars, resetVarsForTesting } from "./vars.ts";

beforeEach(() => {
  resetVarsForTesting();
  listeners.dimensions.clear();
  listeners.appearance.clear();
  window.width = 390;
  scheme = "light";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const compiled = (decls: Parameters<typeof create>[0]) => create(decls);

describe("useProps subscriptions", () => {
  test("static rules subscribe to nothing", () => {
    const styles = compiled({ a: { color: "red" } });
    const { result } = renderHook(() => useProps([styles.a]));
    expect(result.current).toEqual({ style: { color: "red" } });
    expect(listeners.dimensions.size).toBe(0);
    expect(listeners.appearance.size).toBe(0);
  });

  test("media rules subscribe to dimensions and update on change", () => {
    const styles = compiled({
      a: { width: { default: "100%", "@media (min-width: 800px)": "50%" } },
    });
    const { result } = renderHook(() => useProps([styles.a]));
    expect(result.current.style.width).toBe("100%");
    expect(listeners.dimensions.size).toBe(1);
    act(() => {
      window.width = 1000;
      for (const cb of listeners.dimensions) cb();
    });
    expect(result.current.style.width).toBe("50%");
  });

  test("color scheme rules subscribe to Appearance", () => {
    const styles = compiled({
      a: { color: { default: "black", "@media (prefers-color-scheme: dark)": "white" } },
    });
    const { result } = renderHook(() => useProps([styles.a]));
    expect(result.current.style.color).toBe("black");
    expect(listeners.dimensions.size).toBe(0);
    act(() => {
      scheme = "dark";
      for (const cb of listeners.appearance) cb();
    });
    expect(result.current.style.color).toBe("white");
  });
});

describe("useProps interaction", () => {
  test("returns handlers only for interactive rules and reacts to them", () => {
    const plain = compiled({ a: { color: "red" } });
    expect(renderHook(() => useProps([plain.a])).result.current.onPressIn).toBeUndefined();

    const styles = compiled({
      a: { color: { default: "red", ":hover": "blue", ":active": "green" } },
    });
    const { result } = renderHook(() => useProps([styles.a]));
    expect(result.current.style.color).toBe("red");
    act(() => result.current.onHoverIn?.());
    expect(result.current.style.color).toBe("blue");
    act(() => result.current.onPressIn?.());
    expect(result.current.style.color).toBe("green");
    act(() => result.current.onPressOut?.());
    expect(result.current.style.color).toBe("blue");
  });

  test("caller-supplied interaction state and disabled", () => {
    const styles = compiled({ a: { opacity: { default: 1, ":active": 0.8, ":disabled": 0.4 } } });
    const { result } = renderHook(() =>
      useProps([styles.a], { interaction: { active: true }, disabled: true }),
    );
    expect(result.current.style.opacity).toBe(0.4); // later condition keys win, as in StyleX
  });

  test("checked, placeholderShown and readOnly options drive the form-state conditions", () => {
    const styles = compiled({
      a: {
        opacity: { default: 1, ":checked": 0.9 },
        color: { default: "black", ":placeholder-shown": "gray" },
        borderBottomColor: { default: "blue", ":read-only": "silver" },
      },
    });
    const { result, rerender } = renderHook(
      (options: UsePropsOptions) => useProps([styles.a], options),
      { initialProps: {} },
    );
    expect(result.current.style).toMatchObject({
      opacity: 1,
      color: "black",
      borderBottomColor: "blue",
    });
    rerender({ checked: true, placeholderShown: true, readOnly: true });
    expect(result.current.style).toMatchObject({
      opacity: 0.9,
      color: "gray",
      borderBottomColor: "silver",
    });
    // Disabled implies read-only; caller-supplied interaction state fills in unset options.
    rerender({ disabled: true });
    expect(result.current.style.borderBottomColor).toBe("silver");
    rerender({ interaction: { checked: true } });
    expect(result.current.style.opacity).toBe(0.9);
  });
});

const fontSizeWrapper = ({ children }: { children: ReactNode }) =>
  createElement(FontSizeProvider, { fontSize: 20 }, children);

describe("providers", () => {
  test("ThemeProvider scopes variables to a subtree", () => {
    const vars = defineVars({ accent: "red" });
    const styles = compiled({ a: { color: vars.accent } });
    const theme = createTheme(vars, { accent: "blue" });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ThemeProvider, { theme }, children);
    expect(renderHook(() => useProps([styles.a])).result.current.style.color).toBe("red");
    expect(renderHook(() => useProps([styles.a]), { wrapper }).result.current.style.color).toBe(
      "blue",
    );
  });

  test("FontSizeProvider drives em", () => {
    const styles = compiled({ a: { paddingTop: "1em" } });
    const wrapper = fontSizeWrapper;
    expect(
      renderHook(() => useProps([styles.a]), { wrapper }).result.current.style.paddingTop,
    ).toBe(20);
  });
});
