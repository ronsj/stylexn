// Cross-platform elements, web implementation: DOM elements with React
// Native's layout defaults, styled through the real StyleX compiler.
// Native resolves `stylexn/elements` to ./native.ts instead.
import * as stylex from "@stylexjs/stylex";
import type { CompiledStyles, InlineStyles, StyleXArray } from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";

/** What stylex.props() accepts; StyleXArray already allows nested arrays. */
export type SxProp = StyleXArray<
  null | undefined | boolean | CompiledStyles | Readonly<[CompiledStyles, InlineStyles]>
>;

const base = stylex.create({
  // What a React Native <View> looks like.
  view: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    flexShrink: 0,
    position: "relative",
    boxSizing: "border-box",
    minWidth: 0,
    minHeight: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    borderStyle: "solid",
  },
  text: {
    display: "inline",
    margin: 0,
    padding: 0,
  },
  pressable: {
    cursor: "pointer",
    userSelect: "none",
    appearance: "none",
    backgroundColor: "transparent",
    color: "inherit",
    fontFamily: "inherit",
    fontSize: "inherit",
    textAlign: "inherit",
  },
});

export type ViewProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  role?: string;
  "aria-label"?: string;
}>;

export function View({ sx, children, testID, ...rest }: ViewProps) {
  return createElement(
    "div",
    { ...rest, "data-testid": testID, ...stylex.props(base.view, sx) },
    children,
  );
}

export type TextProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  role?: string;
  "aria-label"?: string;
}>;

export function Text({ sx, children, testID, ...rest }: TextProps) {
  return createElement(
    "span",
    { ...rest, "data-testid": testID, ...stylex.props(base.text, sx) },
    children,
  );
}

export type PressableProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  disabled?: boolean;
  onPress?: () => void;
  "aria-label"?: string;
}>;

export function Pressable({ sx, children, testID, disabled, onPress, ...rest }: PressableProps) {
  return createElement(
    "button",
    {
      ...rest,
      type: "button",
      disabled,
      "data-testid": testID,
      onClick: onPress,
      ...stylex.props(base.view, base.pressable, sx),
    },
    children,
  );
}
