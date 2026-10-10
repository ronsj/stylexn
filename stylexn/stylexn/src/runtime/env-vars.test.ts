// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("react-native", () => import("../testing/react-native.ts"));

import { compileRule } from "../compile/compile.ts";
import { resetTestEnv } from "../testing/react-native.ts";
import { create } from "./api.ts";
import { SafeAreaInsetsProvider, type SafeAreaInsets } from "./env-vars.ts";
import { useProps } from "./hooks.ts";
import { resetVarsForTesting } from "./vars.ts";

beforeEach(() => {
  resetVarsForTesting();
  resetTestEnv();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const styles = create({
  bare: { paddingTop: "env(safe-area-inset-top)" },
  fallback: { paddingBottom: "env(safe-area-inset-bottom, 12px)" },
  math: { marginTop: "calc(8px + env(safe-area-inset-top))" },
  sides: {
    padding: "env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)",
  },
});

const INSETS: SafeAreaInsets = { top: 47, right: 4, bottom: 34, left: 2 };
const within =
  (insets: SafeAreaInsets) =>
  ({ children }: { children: ReactNode }) =>
    createElement(SafeAreaInsetsProvider, { insets }, children);

describe("env(safe-area-inset-*)", () => {
  test("rules using it subscribe to variables", () => {
    expect(compileRule({ paddingTop: "env(safe-area-inset-top)" }).rule.usesVars).toBe(true);
  });

  test("without a provider the insets are 0 and the fallback is not used", () => {
    const style = (rule: (typeof styles)[keyof typeof styles]) =>
      renderHook(() => useProps([rule])).result.current.style;
    expect(style(styles.bare)).toEqual({ paddingTop: 0 });
    expect(style(styles.fallback)).toEqual({ paddingBottom: 0 });
    expect(style(styles.math)).toEqual({ marginTop: 8 });
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("SafeAreaInsetsProvider supplies the insets, inside calc() too", () => {
    const wrapper = within(INSETS);
    const style = (rule: (typeof styles)[keyof typeof styles]) =>
      renderHook(() => useProps([rule]), { wrapper }).result.current.style;
    expect(style(styles.bare)).toEqual({ paddingTop: 47 });
    expect(style(styles.fallback)).toEqual({ paddingBottom: 34 });
    expect(style(styles.math)).toEqual({ marginTop: 55 });
    expect(style(styles.sides)).toEqual({
      paddingTop: 47,
      paddingRight: 4,
      paddingBottom: 0,
      paddingLeft: 2,
    });
  });

  test("new insets re-render the subtree", () => {
    let insets = INSETS;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SafeAreaInsetsProvider, { insets }, children);
    const { result, rerender } = renderHook(() => useProps([styles.bare]), { wrapper });
    expect(result.current.style).toEqual({ paddingTop: 47 });
    insets = { ...INSETS, top: 0 };
    rerender();
    expect(result.current.style).toEqual({ paddingTop: 0 });
  });
});
