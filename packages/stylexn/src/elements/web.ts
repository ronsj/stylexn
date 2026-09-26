// Cross-platform elements, web implementation: DOM elements with React
// Native's layout defaults, styled through the real StyleX compiler.
// Native resolves `stylexn/elements` to ./native.ts instead.
import * as stylex from "@stylexjs/stylex";
import type { CompiledStyles, InlineStyles, StyleXArray } from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import type { CommonProps, ImageOwnProps, ScrollViewOwnProps, TextInputOwnProps } from "./types.ts";

export type { A11yProps, CommonProps, Role } from "./types.ts";

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
  // <Image>: a leaf that covers its box by default (resizeMode "cover").
  image: {
    display: "block",
    objectFit: "cover",
  },
  // <TextInput>: no UA chrome; React Native inputs start unstyled.
  input: {
    appearance: "none",
    backgroundColor: "transparent",
    color: "inherit",
    fontFamily: "inherit",
    fontSize: "inherit",
    resize: "none",
  },
  // <ScrollView>: React Native's base styles, with overflow on the axis.
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    overflowY: "auto",
  },
  scrollHorizontal: {
    flexDirection: "row",
    overflowX: "auto",
    overflowY: "hidden",
  },
  contentHorizontal: {
    flexDirection: "row",
  },
});

export type ViewProps = CommonProps & Readonly<{ sx?: SxProp; children?: ReactNode }>;

export function View({ sx, children, testID, ...rest }: ViewProps) {
  return createElement(
    "div",
    { ...rest, "data-testid": testID, ...stylex.props(base.view, sx) },
    children,
  );
}

export type TextProps = CommonProps & Readonly<{ sx?: SxProp; children?: ReactNode }>;

export function Text({ sx, children, testID, ...rest }: TextProps) {
  return createElement(
    "span",
    { ...rest, "data-testid": testID, ...stylex.props(base.text, sx) },
    children,
  );
}

export type PressableProps = CommonProps &
  Readonly<{ sx?: SxProp; children?: ReactNode; disabled?: boolean; onPress?: () => void }>;

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

export type ImageProps = CommonProps & ImageOwnProps & Readonly<{ sx?: SxProp }>;

export function Image({ sx, src, alt, testID, ...rest }: ImageProps) {
  return createElement("img", {
    ...rest,
    src,
    alt,
    "data-testid": testID,
    ...stylex.props(base.view, base.image, sx),
  });
}

export type TextInputProps = CommonProps & TextInputOwnProps & Readonly<{ sx?: SxProp }>;

export function TextInput({
  sx,
  testID,
  onChangeText,
  secureTextEntry,
  multiline,
  disabled,
  ...rest
}: TextInputProps) {
  const onChange = onChangeText
    ? (event: { target: { value: string } }) => onChangeText(event.target.value)
    : undefined;
  return createElement(multiline ? "textarea" : "input", {
    ...rest,
    ...(multiline ? {} : { type: secureTextEntry ? "password" : "text" }),
    disabled,
    onChange,
    "data-testid": testID,
    ...stylex.props(base.view, base.input, sx),
  });
}

export type ScrollViewProps = CommonProps &
  ScrollViewOwnProps &
  Readonly<{ sx?: SxProp; contentSx?: SxProp; children?: ReactNode }>;

export function ScrollView({
  sx,
  contentSx,
  horizontal,
  children,
  testID,
  ...rest
}: ScrollViewProps) {
  return createElement(
    "div",
    {
      ...rest,
      "data-testid": testID,
      ...stylex.props(base.view, base.scroll, horizontal && base.scrollHorizontal, sx),
    },
    createElement(
      "div",
      stylex.props(base.view, horizontal && base.contentHorizontal, contentSx),
      children,
    ),
  );
}
