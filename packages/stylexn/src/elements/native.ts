// Cross-platform elements, React Native implementation: the primitives,
// styled through the StyleXN runtime. Interaction handlers from `useProps`
// are attached only when a rule has :hover/:active/:focus conditions.
import { createElement, type ReactNode } from "react";
import { Pressable as RNPressable, Text as RNText, View as RNView, type Role } from "react-native";
import { FontSizeProvider, useProps } from "../runtime/hooks.ts";
import type { StyleArg } from "../runtime/types.ts";

export type SxProp = StyleArg | readonly StyleArg[];

const toList = (sx: SxProp | undefined): readonly StyleArg[] =>
  sx === undefined ? [] : Array.isArray(sx) ? (sx as readonly StyleArg[]) : [sx as StyleArg];

export type ViewProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  role?: Role;
  "aria-label"?: string;
}>;

export function View({ sx, children, ...rest }: ViewProps) {
  const { style, onHoverIn, onHoverOut, ...extra } = useProps(toList(sx));
  return createElement(
    RNView,
    { ...rest, ...extra, onPointerEnter: onHoverIn, onPointerLeave: onHoverOut, style },
    children,
  );
}

export type TextProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  role?: Role;
  "aria-label"?: string;
}>;

export function Text({ sx, children, ...rest }: TextProps) {
  // Text has no hover/focus events; drop those handlers.
  const {
    style,
    onHoverIn: _h,
    onHoverOut: _o,
    onFocus: _f,
    onBlur: _b,
    ...extra
  } = useProps(toList(sx));
  const fontSize = (style as { fontSize?: unknown }).fontSize;
  const element = createElement(RNText, { ...rest, ...extra, style }, children);
  // Nested text and `em` units are relative to this font size.
  return typeof fontSize === "number"
    ? createElement(FontSizeProvider, { fontSize }, element)
    : element;
}

export type PressableProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  disabled?: boolean;
  onPress?: () => void;
  "aria-label"?: string;
}>;

export function Pressable({ sx, children, disabled, onPress, ...rest }: PressableProps) {
  const { style, ...extra } = useProps(toList(sx), { disabled });
  return createElement(
    RNPressable,
    { ...rest, ...extra, disabled, onPress, style, role: "button" },
    children,
  );
}
