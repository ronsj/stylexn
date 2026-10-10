// @vitest-environment jsdom
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("react-native", () => import("../testing/react-native.ts"));

import {
  resetTestEnv,
  setAccessibilityInfo,
  setColorScheme,
  setWindow,
  testEnv,
} from "../testing/react-native.ts";
import { create } from "./api.ts";
import { resetAccessibilityForTesting } from "./env.ts";
import {
  FontSizeProvider,
  MarkerProvider,
  ThemeProvider,
  useProps,
  type UsePropsOptions,
} from "./hooks.ts";
import { defineMarker, when } from "./markers.ts";
import { createTheme, defineVars, resetVarsForTesting } from "./vars.ts";

const listeners = testEnv.listeners;
/** Event names with at least one AccessibilityInfo listener attached. */
const accessibilityEvents = () =>
  [...listeners.accessibility].filter(([, set]) => set.size > 0).map(([event]) => event);

beforeEach(() => {
  resetVarsForTesting();
  resetTestEnv();
  resetAccessibilityForTesting();
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
    expect(accessibilityEvents()).toEqual([]);
  });

  test("media rules subscribe to dimensions and update on change", () => {
    const styles = compiled({
      a: { width: { default: "100%", "@media (min-width: 800px)": "50%" } },
    });
    const { result } = renderHook(() => useProps([styles.a]));
    expect(result.current.style.width).toBe("100%");
    expect(listeners.dimensions.size).toBe(1);
    act(() => setWindow({ width: 1000 }));
    expect(result.current.style.width).toBe("50%");
  });

  test("color scheme rules subscribe to Appearance", () => {
    const styles = compiled({
      a: { color: { default: "black", "@media (prefers-color-scheme: dark)": "white" } },
    });
    const { result } = renderHook(() => useProps([styles.a]));
    expect(result.current.style.color).toBe("black");
    expect(listeners.dimensions.size).toBe(0);
    act(() => setColorScheme("dark"));
    expect(result.current.style.color).toBe("white");
  });
});

describe("useProps accessibility settings", () => {
  const contrastStyles = compiled({
    a: { color: { default: "gray", "@media (prefers-contrast: more)": "black" } },
  });

  test("prefers-contrast reads darker system colors on iOS and follows its event", async () => {
    testEnv.darkerSystemColors = true;
    const { result } = renderHook(() => useProps([contrastStyles.a]));
    expect(accessibilityEvents()).toEqual(["darkerSystemColorsChanged"]);
    await waitFor(() => expect(result.current.style.color).toBe("black"));
    act(() => setAccessibilityInfo("darkerSystemColors", false));
    expect(result.current.style.color).toBe("gray");
    act(() => setAccessibilityInfo("darkerSystemColors", true));
    expect(result.current.style.color).toBe("black");
  });

  test("prefers-contrast reads high text contrast on Android and follows its event", async () => {
    testEnv.platform = "android";
    testEnv.highTextContrast = true;
    testEnv.darkerSystemColors = false;
    const { result } = renderHook(() => useProps([contrastStyles.a]));
    expect(accessibilityEvents()).toEqual(["highTextContrastChanged"]);
    await waitFor(() => expect(result.current.style.color).toBe("black"));
    act(() => setAccessibilityInfo("highTextContrast", false));
    expect(result.current.style.color).toBe("gray");
  });

  test("elements share one listener; every one sees the initial read and changes", async () => {
    testEnv.darkerSystemColors = true;
    const first = renderHook(() => useProps([contrastStyles.a]));
    const second = renderHook(() => useProps([contrastStyles.a]));
    expect(listeners.accessibility.get("darkerSystemColorsChanged")?.size).toBe(1);
    await waitFor(() => expect(second.result.current.style.color).toBe("black"));
    expect(first.result.current.style.color).toBe("black");
    act(() => setAccessibilityInfo("darkerSystemColors", false));
    expect(first.result.current.style.color).toBe("gray");
    expect(second.result.current.style.color).toBe("gray");
    first.unmount();
    expect(accessibilityEvents()).toEqual(["darkerSystemColorsChanged"]);
    second.unmount();
    expect(accessibilityEvents()).toEqual([]);
  });

  test("reduced transparency and inverted colors attach only what the rules use", async () => {
    testEnv.invertColors = true;
    const styles = compiled({
      a: { opacity: { default: 0.8, "@media (prefers-reduced-transparency: reduce)": 1 } },
      b: { flexGrow: { default: 0, "@media (inverted-colors: inverted)": 2 } },
    });
    const { result } = renderHook(() => useProps([styles.b]));
    expect(accessibilityEvents()).toEqual(["invertColorsChanged"]);
    await waitFor(() => expect(result.current.style.flexGrow).toBe(2));
    const transparency = renderHook(() => useProps([styles.a]));
    expect(accessibilityEvents().toSorted()).toEqual([
      "invertColorsChanged",
      "reduceTransparencyChanged",
    ]);
    act(() => setAccessibilityInfo("reduceTransparency", true));
    expect(transparency.result.current.style.opacity).toBe(1);
  });

  test("reduced transparency and inverted colors are off on Android, with no listeners", () => {
    testEnv.platform = "android";
    const styles = compiled({
      a: {
        opacity: { default: 0.8, "@media (prefers-reduced-transparency)": 1 },
        flexGrow: { default: 0, "@media (inverted-colors: none)": 2 },
      },
    });
    const { result } = renderHook(() => useProps([styles.a]));
    expect(accessibilityEvents()).toEqual([]);
    expect(result.current.style).toMatchObject({ opacity: 0.8, flexGrow: 2 });
  });

  test("rules without accessibility conditions attach no accessibility listeners", () => {
    const styles = compiled({
      a: { width: { default: "100%", "@media (min-width: 800px)": "50%" } },
      b: { color: { default: "black", ":hover": "red" } },
    });
    renderHook(() => useProps([styles.a, styles.b]));
    expect(accessibilityEvents()).toEqual([]);
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

const card = defineMarker("card");

/** A Switch-like element: a marker plus checked/disabled state, published to its children. */
function Toggle({
  checked,
  disabled,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const { marked } = useProps([card], { checked, disabled });
  return marked ? createElement(MarkerProvider, { marked }, children) : children;
}

describe("useProps markers", () => {
  const styles = compiled({
    plain: { color: "red" },
    label: {
      color: { default: "black", [when.ancestor(":checked", card)]: "green" },
      opacity: { default: 1, [when.ancestor(":disabled", card)]: 0.5 },
    },
  });

  test("a marker makes the element track and report its interaction state", () => {
    const { result } = renderHook(() => useProps([card, styles.plain], { disabled: true }));
    expect(result.current.style).toEqual({ color: "red" });
    expect(result.current.marked).toEqual({
      markers: ["card"],
      state: expect.objectContaining({ disabled: true }),
    });
    expect(result.current.onPressIn).toBeTypeOf("function");
    act(() => result.current.onPressIn?.());
    expect(result.current.marked?.state.active).toBe(true);
    // Without a marker: no `marked`, no handlers for static rules.
    const plain = renderHook(() => useProps([styles.plain])).result.current;
    expect(plain).toEqual({ style: { color: "red" } });
  });

  test("MarkerProvider publishes element state (checked, disabled) to descendants from the first render", () => {
    const seen: unknown[] = [];
    function Label() {
      const { style } = useProps([styles.label]);
      seen.push([style.color, style.opacity]);
      return null;
    }
    const label = createElement(Label);
    const { rerender } = render(createElement(Toggle, { checked: true }, label));
    expect(seen).toEqual([["green", 1]]); // seeded: no first frame in the old state
    rerender(createElement(Toggle, { checked: false, disabled: true }, label));
    expect(seen.at(-1)).toEqual(["black", 0.5]);
    rerender(createElement(Toggle, { checked: false }, label));
    expect(seen.at(-1)).toEqual(["black", 1]);
    // Outside any marked ancestor the conditions never hold.
    expect(renderHook(() => useProps([styles.label])).result.current.style).toEqual({
      color: "black",
      opacity: 1,
    });
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
