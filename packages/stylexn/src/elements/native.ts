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
  Pressable as RNPressable,
  Text as RNText,
  View as RNView,
  type Role,
} from "react-native";
import { TextStyleProvider, useInheritedTextStyle, useProps } from "../runtime/hooks.ts";
import { splitInherited } from "../runtime/inherit.ts";
import type { RNLeaf } from "../lower/lower.ts";
import type { StyleArg } from "../runtime/types.ts";

export type SxProp = StyleArg | readonly StyleArg[];

const toList = (sx: SxProp | undefined): readonly StyleArg[] =>
  sx === undefined ? [] : Array.isArray(sx) ? (sx as readonly StyleArg[]) : [sx as StyleArg];

// Animated variants are used only while a transition or animation is attached.
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/** Children wrapped in a TextStyleProvider when there is anything to inherit. */
function inheriting(inherited: Readonly<Record<string, RNLeaf>>, children: ReactNode): ReactNode {
  return Object.keys(inherited).length
    ? createElement(TextStyleProvider, { style: inherited }, children)
    : children;
}

export type ViewProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  role?: Role;
  "aria-label"?: string;
}>;

export function View({ sx, children, ...rest }: ViewProps) {
  const { style, animated, onHoverIn, onHoverOut, ...extra } = useProps(toList(sx));
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  return createElement(
    animated ? Animated.View : RNView,
    { ...rest, ...extra, onPointerEnter: onHoverIn, onPointerLeave: onHoverOut, style: own },
    inheriting(inherited, children),
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

export type PressableProps = Readonly<{
  sx?: SxProp;
  children?: ReactNode;
  testID?: string;
  disabled?: boolean;
  onPress?: () => void;
  "aria-label"?: string;
}>;

export function Pressable({ sx, children, disabled, onPress, ...rest }: PressableProps) {
  const { style, animated, ...extra } = useProps(toList(sx), { disabled });
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  return createElement(
    animated ? AnimatedPressable : RNPressable,
    { ...rest, ...extra, disabled, onPress, style: own, role: "button" },
    inheriting(inherited, children),
  );
}
