// Cross-platform elements, web implementation: DOM elements with React
// Native's layout defaults, styled through the real StyleX compiler.
// Native resolves `stylexn/elements` to ./native.ts instead.
import * as stylex from "@stylexjs/stylex";
import type { CompiledStyles, InlineStyles, StyleXArray } from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import type {
  CommonProps,
  ImageOwnProps,
  ImageSource,
  KeyboardType,
  ScrollViewOwnProps,
  TextInputOwnProps,
} from "./types.ts";

export type {
  A11yProps,
  CommonProps,
  ImageSource,
  KeyboardType,
  ReturnKeyType,
  Role,
  ScrollEvent,
} from "./types.ts";

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
  // What a React Native <Text> looks like: in a row it does not shrink
  // unless told to (set `flexShrink: 1` to wrap instead of overflowing).
  text: {
    display: "inline",
    margin: 0,
    padding: 0,
    flexShrink: 0,
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

/** Strings and bundler objects resolve to a URL; Metro's numeric assets do not exist on web. */
function toSrc(src: ImageSource): string {
  if (typeof src === "string") return src;
  if (typeof src === "number") {
    console.warn("[stylexn] Image: a numeric (Metro) asset has no URL on web");
    return "";
  }
  return src.src ?? src.uri ?? "";
}

export function Image({ sx, src, alt, testID, onLoad, onError, ...rest }: ImageProps) {
  return createElement("img", {
    ...rest,
    src: toSrc(src),
    alt,
    onLoad: onLoad && (() => onLoad()),
    onError: onError && (() => onError()),
    "data-testid": testID,
    ...stylex.props(base.view, base.image, sx),
  });
}

export type TextInputProps = CommonProps & TextInputOwnProps & Readonly<{ sx?: SxProp }>;

/** keyboardType -> HTML `inputMode` and, where one exists, a matching `type`. */
const KEYBOARDS: Readonly<Record<KeyboardType, { inputMode?: string; type?: string }>> = {
  default: {},
  "email-address": { inputMode: "email", type: "email" },
  numeric: { inputMode: "numeric" },
  "decimal-pad": { inputMode: "decimal" },
  "phone-pad": { inputMode: "tel", type: "tel" },
  url: { inputMode: "url", type: "url" },
};

export function TextInput({
  sx,
  testID,
  onChangeText,
  onSubmitEditing,
  onFocus,
  onBlur,
  secureTextEntry,
  multiline,
  disabled,
  keyboardType = "default",
  returnKeyType,
  autoCapitalize,
  autoCorrect,
  ...rest
}: TextInputProps) {
  const onChange = onChangeText
    ? (event: { target: { value: string } }) => onChangeText(event.target.value)
    : undefined;
  const keyboard = KEYBOARDS[keyboardType] ?? {};
  const type = secureTextEntry ? "password" : (keyboard.type ?? "text");
  return createElement(multiline ? "textarea" : "input", {
    ...rest,
    ...(multiline ? {} : { type }),
    inputMode: keyboard.inputMode,
    enterKeyHint: returnKeyType === "done" ? "done" : returnKeyType,
    autoCapitalize,
    autoCorrect: autoCorrect === undefined ? undefined : autoCorrect ? "on" : "off",
    disabled,
    onChange,
    onFocus: onFocus && (() => onFocus()),
    onBlur: onBlur && (() => onBlur()),
    // Enter submits single-line inputs, like React Native's onSubmitEditing.
    onKeyDown:
      onSubmitEditing && !multiline
        ? (event: { key: string }) => {
            if (event.key === "Enter") onSubmitEditing();
          }
        : undefined,
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
  onScroll,
  ...rest
}: ScrollViewProps) {
  return createElement(
    "div",
    {
      ...rest,
      "data-testid": testID,
      onScroll:
        onScroll &&
        ((event: { currentTarget: { scrollLeft: number; scrollTop: number } }) =>
          onScroll({ x: event.currentTarget.scrollLeft, y: event.currentTarget.scrollTop })),
      ...stylex.props(base.view, base.scroll, horizontal && base.scrollHorizontal, sx),
    },
    createElement(
      "div",
      stylex.props(base.view, horizontal && base.contentHorizontal, contentSx),
      children,
    ),
  );
}
