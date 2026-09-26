// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// React Native primitives stand in as DOM elements that expose their style.
vi.mock("react-native", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- vi.mock factories are hoisted
  const host =
    (tag: string) =>
    ({
      style,
      children,
      testID,
      onPress,
    }: {
      style: unknown;
      children?: ReactNode;
      testID?: string;
      onPress?: () => void;
    }) =>
      createElement(
        tag,
        { "data-testid": testID, "data-style": JSON.stringify(style), onClick: onPress },
        children,
      );
  return {
    View: host("div"),
    Text: host("span"),
    Pressable: host("button"),
    Dimensions: { get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }) },
    Appearance: { getColorScheme: () => "light", addChangeListener: () => ({ remove() {} }) },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: () => ({ remove() {} }),
    },
    Platform: { OS: "ios" },
  };
});

import { create } from "../runtime/api.ts";
import { resetVarsForTesting } from "../runtime/vars.ts";
import { Pressable, Text, View } from "./native.ts";

beforeEach(() => {
  resetVarsForTesting();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// This package compiles without DOM types; read the attribute through a local shape.
type WithAttributes = { getAttribute(name: string): string | null };
const styleOf = (testID: string) =>
  JSON.parse(
    (screen.getByTestId(testID) as unknown as WithAttributes).getAttribute("data-style") ?? "null",
  ) as Record<string, unknown>;

const styles = create({
  card: { padding: 8, color: "red", fontSize: 20, fontFamily: "Inter" },
  big: { fontSize: 32 },
  blue: { color: "blue" },
  em: { paddingTop: "1em", lineHeight: 1.5 },
  pad: { paddingTop: "1em" },
  button: { color: "white", backgroundColor: "black" },
});

describe("text inheritance", () => {
  test("View keeps layout keys and hands text keys to nested Text", () => {
    render(
      <View sx={styles.card} testID="view">
        <Text testID="text">hi</Text>
      </View>,
    );
    expect(styleOf("view")).toEqual({
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
    });
    expect(styleOf("text")).toEqual({ color: "red", fontSize: 20, fontFamily: "Inter" });
  });

  test("the element's own text style wins; deeper Views add to the cascade", () => {
    render(
      <View sx={styles.card}>
        <View sx={styles.big} testID="inner">
          <Text sx={styles.blue} testID="text">
            hi
          </Text>
        </View>
      </View>,
    );
    expect(styleOf("inner")).toEqual({});
    expect(styleOf("text")).toEqual({ color: "blue", fontSize: 32, fontFamily: "Inter" });
  });

  test("em units resolve against the inherited font size", () => {
    render(
      <View sx={styles.card}>
        <Text sx={styles.em} testID="text">
          hi
        </Text>
      </View>,
    );
    expect(styleOf("text")).toEqual({
      color: "red",
      fontSize: 20,
      fontFamily: "Inter",
      paddingTop: 20,
      lineHeight: 30,
    });
  });

  test("Text provides its own text style to nested elements", () => {
    render(
      <Text sx={styles.big}>
        <Text sx={styles.em} testID="nested">
          hi
        </Text>
      </Text>,
    );
    expect(styleOf("nested")).toEqual({ fontSize: 32, paddingTop: 32, lineHeight: 48 });
  });

  test("Pressable behaves like View", () => {
    render(
      <Pressable sx={styles.button} testID="button">
        <Text testID="label">Go</Text>
      </Pressable>,
    );
    expect(styleOf("button")).toEqual({ backgroundColor: "black" });
    expect(styleOf("label")).toEqual({ color: "white" });
  });

  test("nothing to inherit: no provider, plain styles", () => {
    render(
      <View sx={styles.pad} testID="view">
        <Text testID="text">hi</Text>
      </View>,
    );
    expect(styleOf("view")).toEqual({ paddingTop: 14 }); // config.fontSize = 14
    expect(styleOf("text")).toEqual({});
  });
});
