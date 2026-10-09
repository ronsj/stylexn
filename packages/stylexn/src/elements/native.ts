"use client";
/* oxlint-disable react/refs -- refs are read in imperative-handle factories and event handlers, which run outside render */
// Cross-platform elements, React Native implementation: the primitives,
// styled through the StyleXN runtime. Interaction handlers from `useProps`
// are attached only when a rule has :hover/:active/:focus conditions.
//
// Text inheritance: CSS cascades `color`, `fontSize`, ... from any element to
// the text inside it; React Native only inherits between nested Text. So
// View and Pressable move those keys off their own style and into
// TextStyleProvider, and Text merges the inherited values under its own.
import {
  createElement,
  Fragment,
  isValidElement,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import {
  Animated,
  FlatList as RNFlatList,
  Image as RNImage,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Switch as RNSwitch,
  Text as RNText,
  TextInput as RNTextInput,
  View as RNView,
} from "react-native";
import {
  TextStyleProvider,
  ThemeProvider,
  useInheritedTextStyle,
  useProps,
} from "../runtime/hooks.ts";
import { flattenArgs } from "../runtime/resolve.ts";
import { config } from "../runtime/env.ts";
import { mergeInherited, splitInherited } from "../runtime/inherit.ts";
import type { RNLeaf } from "../lower/lower.ts";
import type { StyleArg } from "../runtime/types.ts";
import type {
  CommonProps,
  FlatListHandle,
  FlatListOwnProps,
  ImageOwnProps,
  ImageSource,
  PressableOwnProps,
  ScrollViewHandle,
  ScrollViewOwnProps,
  SwitchOwnProps,
  TextInputHandle,
  TextInputOwnProps,
} from "./types.ts";

export type {
  A11yProps,
  CommonProps,
  FlatListHandle,
  ImageSource,
  KeyboardType,
  ReturnKeyType,
  Role,
  ScrollEvent,
  ScrollViewHandle,
  TextInputHandle,
} from "./types.ts";

export type SxProp = StyleArg | readonly StyleArg[];

const toList = (sx: SxProp | undefined): readonly StyleArg[] =>
  sx === undefined ? [] : Array.isArray(sx) ? (sx as readonly StyleArg[]) : [sx as StyleArg];

// Animated variants are used only while a transition or animation is attached.
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);
const AnimatedTextInput = Animated.createAnimatedComponent(RNTextInput);
const AnimatedSwitch = Animated.createAnimatedComponent(RNSwitch);

/**
 * Elements that forward a ref: React's `createElement` typing for a union of
 * the plain and the Animated component accepts no `ref`, so those take
 * their props loosely (the public props are typed on the element instead).
 */
const withRef = (component: unknown) => component as ComponentType<Record<string, unknown>>;

/** Both callbacks in order, or nothing when neither is set. */
const compose = (first?: () => void, second?: () => void): (() => void) | undefined =>
  first || second
    ? () => {
        first?.();
        second?.();
      }
    : undefined;

/**
 * Children wrapped in a TextStyleProvider when there is anything to inherit
 * and something that could read it: a string or number child has no style.
 */
function inheriting(inherited: Readonly<Record<string, RNLeaf>>, children: ReactNode): ReactNode {
  if (typeof children !== "object" || children === null) return children;
  for (const _ in inherited)
    return createElement(TextStyleProvider, { style: inherited }, children);
  return children;
}

/**
 * What an element passes down: inherited text style, and the themes in its
 * `sx`. On the web a theme in `sx` sets custom properties that cascade to
 * every descendant; a ThemeProvider around the children does the same here.
 */
function cascade(
  sx: SxProp | undefined,
  inherited: Readonly<Record<string, RNLeaf>>,
  children: ReactNode,
): ReactNode {
  const out = inheriting(inherited, children);
  if (typeof out !== "object" || out === null) return out;
  const { themes } = flattenArgs(toList(sx));
  return themes.length ? createElement(ThemeProvider, { theme: themes }, out) : out;
}

export type ViewProps = CommonProps & Readonly<{ sx?: SxProp; children?: ReactNode }>;

export function View({ sx, children, ...rest }: ViewProps) {
  const { style, animated, onHoverIn, onHoverOut, ...extra } = useProps(toList(sx));
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  return createElement(
    animated ? Animated.View : RNView,
    { ...rest, ...extra, onPointerEnter: onHoverIn, onPointerLeave: onHoverOut, style: own },
    cascade(sx, inherited, children),
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
  const merged = mergeInherited(inherited, style as Record<string, RNLeaf>, config.fontSize);
  // Nested text and `em` units are relative to this element's text style.
  return createElement(
    animated ? Animated.Text : RNText,
    { ...rest, ...extra, style: merged },
    cascade(sx, splitInherited(style as Record<string, RNLeaf>).inherited, children),
  );
}

export type PressableProps = CommonProps &
  PressableOwnProps &
  Readonly<{ sx?: SxProp; children?: ReactNode }>;

export function Pressable({
  sx,
  children,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  ...rest
}: PressableProps) {
  // The runtime tracks presses for `:active`; the author's callbacks run after it.
  const {
    style,
    animated,
    onPressIn: trackIn,
    onPressOut: trackOut,
    ...extra
  } = useProps(toList(sx), { disabled });
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  return createElement(
    animated ? AnimatedPressable : RNPressable,
    {
      ...rest,
      ...extra,
      disabled,
      onPress,
      onPressIn: compose(trackIn, onPressIn),
      onPressOut: compose(trackOut, onPressOut),
      onLongPress,
      style: own,
      role: "button",
    },
    cascade(sx, inherited, children),
  );
}

export type SwitchProps = CommonProps & SwitchOwnProps & Readonly<{ sx?: SxProp }>;

/** A toggle. `sx` styles the control itself (layout, margins); colours are the platform's. */
export function Switch({ sx, value, onValueChange, disabled, ...rest }: SwitchProps) {
  const {
    style,
    animated,
    onHoverIn: _h,
    onHoverOut: _o,
    ...extra
  } = useProps(toList(sx), {
    disabled,
    checked: value,
    // A checkbox is always :read-only in CSS (only text-like controls are read-write).
    readOnly: true,
  });
  return createElement(animated ? AnimatedSwitch : RNSwitch, {
    ...rest,
    ...extra,
    value,
    onValueChange,
    disabled,
    style,
  });
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

export type TextInputProps = CommonProps &
  TextInputOwnProps &
  Readonly<{ sx?: SxProp; ref?: Ref<TextInputHandle> }>;

type TextInputLike = { focus(): void; blur(): void; clear(): void };

/**
 * Style-derived props land here: `::placeholder` color becomes
 * `placeholderTextColor`, `caretColor` becomes `cursorColor`. `:focus`
 * conditions attach onFocus/onBlur from the runtime.
 *
 * `:placeholder-shown` needs to know whether the field is empty: from
 * `value` when controlled, otherwise tracked as one boolean that changes
 * only when the text goes from empty to non-empty or back (typing does not
 * re-render per keystroke).
 *
 * Deliberately not part of the text cascade: on web the UA stylesheet gives
 * inputs their own font and colour, so `color`/`fontSize` on an enclosing
 * View do not reach an input there either. Style the input itself.
 */
export function TextInput({
  sx,
  disabled,
  readOnly,
  value,
  defaultValue,
  placeholder,
  onChangeText,
  onFocus,
  onBlur,
  onSubmitEditing,
  autoCorrect,
  ref,
  ...rest
}: TextInputProps) {
  const inner = useRef<TextInputLike | null>(null);
  // Uncontrolled emptiness; ignored while `value` is set.
  const [typedEmpty, setTypedEmpty] = useState(() => !defaultValue);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => inner.current?.focus(),
      blur: () => inner.current?.blur(),
      clear: () => {
        inner.current?.clear();
        setTypedEmpty(true);
      },
    }),
    [],
  );
  const empty = value === undefined ? typedEmpty : value === "";
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
  } = useProps(toList(sx), {
    disabled,
    readOnly,
    placeholderShown: !!placeholder && empty,
  });
  return createElement(withRef(animated ? AnimatedTextInput : RNTextInput), {
    ...rest,
    ...extra,
    ref: inner,
    value,
    defaultValue,
    placeholder,
    editable: !disabled,
    readOnly,
    autoCorrect,
    onChangeText: (text: string) => {
      if ((text === "") !== typedEmpty) setTypedEmpty(text === "");
      onChangeText?.(text);
    },
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
  Readonly<{ sx?: SxProp; contentSx?: SxProp; children?: ReactNode; ref?: Ref<ScrollViewHandle> }>;

type NativeScrollEvent = { nativeEvent: { contentOffset: { x: number; y: number } } };
const normaliseScroll = (onScroll?: (event: { x: number; y: number }) => void) =>
  onScroll &&
  ((event: NativeScrollEvent) =>
    onScroll({ x: event.nativeEvent.contentOffset.x, y: event.nativeEvent.contentOffset.y }));

type ScrollViewLike = {
  scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
  scrollToEnd(options?: { animated?: boolean }): void;
};

/** `sx` styles the scroll container, `contentSx` its content (contentContainerStyle). */
export function ScrollView({ sx, contentSx, children, onScroll, ref, ...rest }: ScrollViewProps) {
  const { style, animated, onHoverIn, onHoverOut, ...extra } = useProps(toList(sx));
  const content = useProps(toList(contentSx));
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  const inner = useRef<ScrollViewLike | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollTo: ({ x, y, animated: smooth = true }) =>
        inner.current?.scrollTo({ x, y, animated: smooth }),
      scrollToEnd: ({ animated: smooth = true } = {}) =>
        inner.current?.scrollToEnd({ animated: smooth }),
    }),
    [],
  );
  return createElement(
    withRef(animated ? Animated.ScrollView : RNScrollView),
    {
      ...rest,
      ...extra,
      ref: inner,
      onPointerEnter: onHoverIn,
      onPointerLeave: onHoverOut,
      onScroll: normaliseScroll(onScroll),
      scrollEventThrottle: onScroll ? 16 : undefined,
      style: own,
      contentContainerStyle: content.style,
    },
    cascade(sx, inherited, children),
  );
}

/**
 * The elements expose the shared prop subset on both platforms; native-only
 * React Native props go to the primitive with `useProps`.
 */
export type FlatListProps<T> = CommonProps &
  FlatListOwnProps<T> &
  Readonly<{ sx?: SxProp; contentSx?: SxProp; ref?: Ref<FlatListHandle> }>;

type FlatListLike = {
  scrollToOffset(options: { offset: number; animated?: boolean }): void;
  scrollToIndex(options: { index: number; animated?: boolean }): void;
  scrollToEnd(options?: { animated?: boolean }): void;
};

/** React Native's List*Component props take an element or a component; strings need a wrapper. */
const asElement = (node: ReactNode): ReactElement | undefined =>
  node === null || node === undefined || typeof node === "boolean"
    ? undefined
    : isValidElement(node)
      ? node
      : createElement(Fragment, null, node);

/**
 * A virtualised list (React Native's FlatList). `sx` styles the scroll
 * container, `contentSx` the content; text styles cascade into the items.
 */
export function FlatList<T>({
  sx,
  contentSx,
  data,
  renderItem,
  keyExtractor,
  header,
  footer,
  empty,
  separator,
  onScroll,
  onEndReached,
  onEndReachedThreshold,
  ref,
  ...rest
}: FlatListProps<T>) {
  const { style, animated, onHoverIn, onHoverOut, ...extra } = useProps(toList(sx));
  const content = useProps(toList(contentSx));
  const { own, inherited } = splitInherited(style as Record<string, RNLeaf>);
  const inner = useRef<FlatListLike | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollToOffset: ({ offset, animated: smooth = true }) =>
        inner.current?.scrollToOffset({ offset, animated: smooth }),
      scrollToIndex: ({ index, animated: smooth = true }) =>
        inner.current?.scrollToIndex({ index, animated: smooth }),
      scrollToEnd: ({ animated: smooth = true } = {}) =>
        inner.current?.scrollToEnd({ animated: smooth }),
    }),
    [],
  );
  const separatorElement = asElement(separator);
  const list = createElement(withRef(animated ? Animated.FlatList : RNFlatList), {
    ...rest,
    ...extra,
    ref: inner,
    data,
    renderItem: ({ item, index }: { item: T; index: number }) => renderItem({ item, index }),
    keyExtractor,
    ListHeaderComponent: asElement(header),
    ListFooterComponent: asElement(footer),
    ListEmptyComponent: asElement(empty),
    ItemSeparatorComponent: separatorElement && (() => separatorElement),
    onPointerEnter: onHoverIn,
    onPointerLeave: onHoverOut,
    onScroll: normaliseScroll(onScroll),
    scrollEventThrottle: onScroll ? 16 : undefined,
    onEndReached: onEndReached && (() => onEndReached()),
    onEndReachedThreshold,
    style: own,
    contentContainerStyle: content.style,
  });
  return cascade(sx, inherited, list);
}
