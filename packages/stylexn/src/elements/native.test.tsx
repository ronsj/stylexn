// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// React Native primitives stand in as DOM elements that expose their style.
vi.mock("react-native", async () => {
  const { Animated, Easing } = await import("../runtime/fake-animated.ts");
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- vi.mock factories are hoisted
  const element =
    (tag: string) =>
    ({
      style,
      children,
      testID,
      onPress,
      onPressIn,
      onPressOut,
      ...rest
    }: {
      style: unknown;
      children?: ReactNode;
      testID?: string;
      onPress?: () => void;
      onPressIn?: () => void;
      onPressOut?: () => void;
      [prop: string]: unknown;
    }) =>
      createElement(
        tag,
        {
          "data-testid": testID,
          "data-style": JSON.stringify(style),
          "data-props": JSON.stringify(rest),
          onClick: onPress,
          onMouseDown: onPressIn,
          onMouseUp: onPressOut,
        },
        children,
      );
  return {
    Animated: { ...Animated, Image: Animated.View, ScrollView: Animated.View },
    Easing,
    View: element("div"),
    Text: element("span"),
    Pressable: element("button"),
    Image: element("img"),
    TextInput: element("input"),
    ScrollView: element("scroll-view"),
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
import { Image, Pressable, ScrollView, Text, TextInput, View } from "./native.ts";

beforeEach(() => {
  resetVarsForTesting();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// This package compiles without DOM types; read elements through a local shape.
type Host = { getAttribute(name: string): string | null; tagName: string };
const host = (testID: string) => screen.getByTestId(testID) as unknown as Host;
const styleOf = (testID: string) =>
  JSON.parse(host(testID).getAttribute("data-style") ?? "null") as Record<string, unknown>;
const tagOf = (testID: string) => host(testID).tagName;
const propsOf = (testID: string) =>
  JSON.parse(host(testID).getAttribute("data-props") ?? "null") as Record<string, unknown>;

const styles = create({
  card: { padding: 8, color: "red", fontSize: 20, fontFamily: "Inter" },
  big: { fontSize: 32 },
  blue: { color: "blue" },
  em: { paddingTop: "1em", lineHeight: 1.5 },
  pad: { paddingTop: "1em" },
  button: { color: "white", backgroundColor: "black" },
  fading: { opacity: { default: 1, ":active": 0.5 }, transitionDuration: "100ms" },
  input: {
    color: { default: "black", "::placeholder": "gray", ":focus": "blue" },
    caretColor: "red",
    borderBottomWidth: 1,
  },
  clamp: { lineClamp: 2, textOverflow: "ellipsis" },
  scroll: { color: "red", padding: 4 },
  content: { gap: 8 },
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

describe("animated elements", () => {
  test("switch to Animated components only while a transition is attached", () => {
    render(
      <Pressable sx={styles.fading} testID="p">
        <Text testID="t">hi</Text>
      </Pressable>,
    );
    expect(tagOf("p")).toBe("BUTTON");
    fireEvent.mouseDown(screen.getByTestId("p")); // the host mock maps onPressIn to mousedown
    expect(tagOf("p")).toBe("ANIMATED-PRESSABLE");
    expect(tagOf("t")).toBe("SPAN");
    expect(styleOf("p").opacity).toMatchObject({ $$interpolation: { outputRange: [1, 0.5] } });
  });
});

describe("Image, TextInput, ScrollView", () => {
  test("Image maps src to a uri source and keeps alt", () => {
    render(<Image sx={styles.pad} src="https://x/y.png" alt="y" testID="img" />);
    expect(propsOf("img")).toMatchObject({ source: { uri: "https://x/y.png" }, alt: "y" });
    expect(styleOf("img")).toEqual({ paddingTop: 14 });
  });

  test("TextInput receives style-derived props and focus handlers", () => {
    render(<TextInput sx={styles.input} placeholder="Name" testID="in" />);
    expect(propsOf("in")).toMatchObject({
      placeholder: "Name",
      placeholderTextColor: "gray",
      cursorColor: "red",
      editable: true,
    });
    expect(styleOf("in")).toEqual({ color: "black", borderBottomWidth: 1 });
    // :focus is driven by the runtime's onFocus/onBlur, which the input receives.
    expect(Object.keys(propsOf("in"))).not.toContain("onHoverIn");
    render(<TextInput sx={styles.input} disabled testID="off" />);
    expect(propsOf("off").editable).toBe(false);
  });

  test("Text gets numberOfLines and ellipsizeMode from lineClamp/textOverflow", () => {
    render(
      <Text sx={styles.clamp} testID="t">
        long
      </Text>,
    );
    expect(propsOf("t")).toMatchObject({ numberOfLines: 2, ellipsizeMode: "tail" });
  });

  test("ScrollView styles the container and the content separately and cascades text", () => {
    render(
      <ScrollView sx={styles.scroll} contentSx={styles.content} horizontal testID="s">
        <Text testID="t">hi</Text>
      </ScrollView>,
    );
    expect(tagOf("s")).toBe("SCROLL-VIEW");
    expect(styleOf("s")).toEqual({
      paddingTop: 4,
      paddingRight: 4,
      paddingBottom: 4,
      paddingLeft: 4,
    });
    expect(propsOf("s")).toMatchObject({
      horizontal: true,
      contentContainerStyle: { rowGap: 8, columnGap: 8 },
    });
    expect(styleOf("t")).toEqual({ color: "red" });
  });

  test("accessibility props pass through unchanged", () => {
    render(
      <View role="button" aria-label="go" aria-disabled testID="v">
        <Text>x</Text>
      </View>,
    );
    expect(propsOf("v")).toMatchObject({
      role: "button",
      "aria-label": "go",
      "aria-disabled": true,
    });
  });
});
