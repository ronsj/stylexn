// Cross-platform elements, React Native implementation: the primitives,
// styled through the StyleXN runtime. Interaction handlers from `useProps`
// are attached only when a rule has :hover/:active/:focus conditions.
//
// Text inheritance: CSS cascades `color`, `fontSize`, ... from any element to
// the text inside it; React Native only inherits between nested Text. So
// View and Pressable move those keys off their own style and into
// TextStyleProvider, and Text merges the inherited values under its own.
import { createElement, type ReactNode } from "react";
import {
  Animated,
  Image as RNImage,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Text as RNText,
  TextInput as RNTextInput,
  View as RNView,
} from "react-native";
import { TextStyleProvider, useInheritedTextStyle, useProps } from "../runtime/hooks.ts";
import { splitInherited } from "../runtime/inherit.ts";
import type { RNLeaf } from "../lower/lower.ts";
import type { StyleArg } from "../runtime/types.ts";
import type {
  CommonProps,
  ImageOwnProps,
  ImageSource,
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

export type SxProp = StyleArg | readonly StyleArg[];

const toList = (sx: SxProp | undefined): readonly StyleArg[] =>
  sx === undefined ? [] : Array.isArray(sx) ? (sx as readonly StyleArg[]) : [sx as StyleArg];

// Animated variants are used only while a transition or animation is attached.
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);
const AnimatedTextInput = Animated.createAnimatedComponent(RNTextInput);

/** Children wrapped in a TextStyleProvider when there is anything to inherit. */
function inheriting(inherited: Readonly<Record<string, RNLeaf>>, children: ReactNode): ReactNode {
  return Object.keys(inherited).length
    ? createElement(TextStyleProvider, { style: inherited }, children)
    : children;
}

export type ViewProps = CommonProps & Readonly<{ sx?: SxProp; children?: ReactNode }>;

export function View({ sx, children, ...rest }: ViewProps) {
  const { style, animated, onHoverIn, onHoverOut, ...extra } = useProps(toList(sx));
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  return createElement(
    animated ? Animated.View : RNView,
    { ...rest, ...extra, onPointerEnter: onHoverIn, onPointerLeave: onHoverOut, style: own },
    inheriting(inherited, children),
  );
}

export type TextProps = CommonProps & Readonly<{ sx?: SxProp; children?: ReactNode }>;

export function Text({ sx, children, ...rest }: TextProps) {
  // Text has no hover/focus events; drop those handlers.
  const {
    style,
    animated,
    onHoverIn: _h,
    onHoverOut: _o,
    onFocus: _f,
    onBlur: _b,
    ...extra
  } = useProps(toList(sx));
  // Inherited text properties sit under the element's own (the CSS cascade).
  const inherited = useInheritedTextStyle();
  const merged = { ...inherited, ...style };
  // Nested text and `em` units are relative to this element's text style.
  return createElement(
    animated ? Animated.Text : RNText,
    { ...rest, ...extra, style: merged },
    inheriting(splitInherited(style as Record<string, RNLeaf>).inherited, children),
  );
}

export type PressableProps = CommonProps &
  Readonly<{ sx?: SxProp; children?: ReactNode; disabled?: boolean; onPress?: () => void }>;

export function Pressable({ sx, children, disabled, onPress, ...rest }: PressableProps) {
  const { style, animated, ...extra } = useProps(toList(sx), { disabled });
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  return createElement(
    animated ? AnimatedPressable : RNPressable,
    { ...rest, ...extra, disabled, onPress, style: own, role: "button" },
    inheriting(inherited, children),
  );
}

export type ImageProps = CommonProps & ImageOwnProps & Readonly<{ sx?: SxProp }>;

/** A leaf image; `objectFit` from styles applies (React Native ≥ 0.72). */
/** `require()` results (numbers) pass through; strings and objects become `{ uri }`. */
function toSource(src: ImageSource): number | { uri: string } {
  if (typeof src === "number") return src;
  if (typeof src === "string") return { uri: src };
  return { uri: src.uri ?? src.src ?? "" };
}

export function Image({ sx, src, alt, onLoad, onError, ...rest }: ImageProps) {
  // Image has no pointer events on native: hover conditions never hold.
  const { style, animated, onHoverIn: _h, onHoverOut: _o, ...extra } = useProps(toList(sx));
  return createElement(animated ? Animated.Image : RNImage, {
    ...rest,
    ...extra,
    source: toSource(src),
    alt,
    onLoad: onLoad && (() => onLoad()),
    onError: onError && (() => onError()),
    style,
  });
}

export type TextInputProps = CommonProps & TextInputOwnProps & Readonly<{ sx?: SxProp }>;

/**
 * Style-derived props land here: `::placeholder` color becomes
 * `placeholderTextColor`, `caretColor` becomes `cursorColor`. `:focus`
 * conditions attach onFocus/onBlur from the runtime.
 */
export function TextInput({
  sx,
  disabled,
  onFocus,
  onBlur,
  onSubmitEditing,
  autoCorrect,
  ...rest
}: TextInputProps) {
  const {
    style,
    animated,
    onHoverIn: _h,
    onHoverOut: _o,
    onPressIn: _i,
    onPressOut: _u,
    onFocus: trackFocus,
    onBlur: trackBlur,
    ...extra
  } = useProps(toList(sx), { disabled });
  return createElement(animated ? AnimatedTextInput : RNTextInput, {
    ...rest,
    ...extra,
    editable: !disabled,
    autoCorrect,
    // The runtime tracks focus for `:focus`; the author's callbacks run after it.
    onFocus: () => {
      trackFocus?.();
      onFocus?.();
    },
    onBlur: () => {
      trackBlur?.();
      onBlur?.();
    },
    onSubmitEditing: onSubmitEditing && (() => onSubmitEditing()),
    style,
  });
}

export type ScrollViewProps = CommonProps &
  ScrollViewOwnProps &
  Readonly<{ sx?: SxProp; contentSx?: SxProp; children?: ReactNode }>;

/** `sx` styles the scroll container, `contentSx` its content (contentContainerStyle). */
export function ScrollView({ sx, contentSx, children, onScroll, ...rest }: ScrollViewProps) {
  const { style, animated, onHoverIn, onHoverOut, ...extra } = useProps(toList(sx));
  const content = useProps(toList(contentSx));
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  return createElement(
    animated ? Animated.ScrollView : RNScrollView,
    {
      ...rest,
      ...extra,
      onPointerEnter: onHoverIn,
      onPointerLeave: onHoverOut,
      onScroll:
        onScroll &&
        ((event: { nativeEvent: { contentOffset: { x: number; y: number } } }) =>
          onScroll({ x: event.nativeEvent.contentOffset.x, y: event.nativeEvent.contentOffset.y })),
      scrollEventThrottle: onScroll ? 16 : undefined,
      style: own,
      contentContainerStyle: content.style,
    },
    inheriting(inherited, children),
  );
}
