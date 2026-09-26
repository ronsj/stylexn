"use client";
/* oxlint-disable react/refs -- refs are read in imperative-handle factories and event handlers, which run outside render */
// Cross-platform elements, web implementation: DOM elements with React
// Native's layout defaults, styled through the real StyleX compiler. The
// directive lets React Server Components (Next.js) import the elements
// directly: they use hooks, so they are client components.
// Native resolves `stylexn/elements` to ./native.ts instead.
import * as stylex from "@stylexjs/stylex";
import type { CompiledStyles, InlineStyles, StyleXArray } from "@stylexjs/stylex";
import {
  createElement,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import type {
  CommonProps,
  FlatListHandle,
  FlatListOwnProps,
  ImageOwnProps,
  ImageSource,
  KeyboardType,
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
  // <Switch>: the platform checkbox with a switch role; margins come from sx.
  switch: {
    margin: 0,
    flexShrink: 0,
  },
});

/** How long a press must be held to count as a long press (React Native's default). */
const LONG_PRESS_MS = 500;

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
  PressableOwnProps &
  Readonly<{ sx?: SxProp; children?: ReactNode }>;

export function Pressable({
  sx,
  children,
  testID,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  ...rest
}: PressableProps) {
  // Pointer events drive press-in/out and the long-press timer; a long press
  // swallows the click that follows it, as on native. Keyboard activation
  // arrives as a click alone and always counts as a press.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const tracking = onPressIn || onPressOut || onLongPress;
  const down = () => {
    onPressIn?.();
    longPressed.current = false;
    if (onLongPress) {
      timer.current = setTimeout(() => {
        timer.current = null;
        longPressed.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    }
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    onPressOut?.();
  };
  return createElement(
    "button",
    {
      ...rest,
      type: "button",
      disabled,
      "data-testid": testID,
      onClick:
        onPress &&
        (() => {
          if (longPressed.current) longPressed.current = false;
          else onPress();
        }),
      onPointerDown: tracking ? down : undefined,
      onPointerUp: tracking ? up : undefined,
      onPointerLeave: tracking ? up : undefined,
      onPointerCancel: tracking ? up : undefined,
      ...stylex.props(base.view, base.pressable, sx),
    },
    children,
  );
}

export type SwitchProps = CommonProps & SwitchOwnProps & Readonly<{ sx?: SxProp }>;

/** A toggle: a checkbox with the switch role. `sx` styles the control itself. */
export function Switch({ sx, value, onValueChange, disabled, testID, ...rest }: SwitchProps) {
  return createElement("input", {
    ...rest,
    type: "checkbox",
    role: "switch",
    checked: value,
    disabled,
    onChange: (event: { target: { checked: boolean } }) => onValueChange?.(event.target.checked),
    "data-testid": testID,
    ...stylex.props(base.switch, sx),
  });
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
  // A static or server-rendered image may have finished loading before
  // hydration, so the load event never reaches React; report it on mount.
  // The callback is read through a ref so the effect runs once, whatever
  // identity `onLoad` has on later renders.
  const img = useRef<{ complete: boolean; naturalWidth: number } | null>(null);
  const loaded = useRef(onLoad);
  loaded.current = onLoad;
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) loaded.current?.();
  }, []);
  return createElement("img", {
    ...rest,
    ref: img,
    src: toSrc(src),
    alt,
    onLoad: onLoad && (() => onLoad()),
    onError: onError && (() => onError()),
    "data-testid": testID,
    ...stylex.props(base.view, base.image, sx),
  });
}

export type TextInputProps = CommonProps &
  TextInputOwnProps &
  Readonly<{ sx?: SxProp; ref?: Ref<TextInputHandle> }>;

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
  ref,
  ...rest
}: TextInputProps) {
  // No DOM lib in this package: the input is typed by what the handle uses.
  const inner = useRef<{ focus(): void; blur(): void; value: string } | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => inner.current?.focus(),
      blur: () => inner.current?.blur(),
      clear: () => {
        if (inner.current) inner.current.value = "";
        onChangeText?.("");
      },
    }),
    [onChangeText],
  );
  const onChange = onChangeText
    ? (event: { target: { value: string } }) => onChangeText(event.target.value)
    : undefined;
  const keyboard = KEYBOARDS[keyboardType] ?? {};
  const type = secureTextEntry ? "password" : (keyboard.type ?? "text");
  return createElement(multiline ? "textarea" : "input", {
    ...rest,
    ref: inner,
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
  Readonly<{ sx?: SxProp; contentSx?: SxProp; children?: ReactNode; ref?: Ref<ScrollViewHandle> }>;

type Scroller = {
  scrollTo(options: { left?: number; top?: number; behavior?: "smooth" | "instant" }): void;
  scrollWidth: number;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
};

const behavior = (animated: boolean) => (animated ? "smooth" : "instant");

const scrollEvent = (onScroll?: (event: { x: number; y: number }) => void) =>
  onScroll &&
  ((event: { currentTarget: { scrollLeft: number; scrollTop: number } }) =>
    onScroll({ x: event.currentTarget.scrollLeft, y: event.currentTarget.scrollTop }));

export function ScrollView({
  sx,
  contentSx,
  horizontal,
  children,
  testID,
  onScroll,
  ref,
  ...rest
}: ScrollViewProps) {
  const inner = useRef<Scroller | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollTo: ({ x, y, animated: smooth = true }) =>
        inner.current?.scrollTo({ left: x, top: y, behavior: behavior(smooth) }),
      scrollToEnd: ({ animated: smooth = true } = {}) => {
        const el = inner.current;
        if (!el) return;
        el.scrollTo(
          horizontal
            ? { left: el.scrollWidth, behavior: behavior(smooth) }
            : { top: el.scrollHeight, behavior: behavior(smooth) },
        );
      },
    }),
    [horizontal],
  );
  return createElement(
    "div",
    {
      ...rest,
      ref: inner,
      "data-testid": testID,
      onScroll: scrollEvent(onScroll),
      ...stylex.props(base.view, base.scroll, horizontal && base.scrollHorizontal, sx),
    },
    createElement(
      "div",
      stylex.props(base.view, horizontal && base.contentHorizontal, contentSx),
      children,
    ),
  );
}

export type FlatListProps<T> = CommonProps &
  FlatListOwnProps<T> &
  Readonly<{ sx?: SxProp; contentSx?: SxProp; ref?: Ref<FlatListHandle> }>;

const defaultKey = (item: unknown, index: number): string => {
  const record = item as { key?: unknown; id?: unknown } | null;
  const key = record?.key ?? record?.id;
  return typeof key === "string" || typeof key === "number" ? String(key) : String(index);
};

/**
 * The list on web: every item is rendered (no virtualisation), each in its
 * own cell like React Native's FlatList, inside a scroll container.
 * `onEndReached` fires once each time the end comes within the threshold.
 */
export function FlatList<T>({
  sx,
  contentSx,
  data,
  renderItem,
  keyExtractor = defaultKey,
  header,
  footer,
  empty,
  separator,
  horizontal,
  testID,
  onScroll,
  onEndReached,
  onEndReachedThreshold = 2,
  ref,
  ...rest
}: FlatListProps<T>) {
  const inner = useRef<Scroller | null>(null);
  const content = useRef<{
    querySelector(s: string): { offsetLeft: number; offsetTop: number } | null;
  } | null>(null);
  const nearEnd = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      scrollToOffset: ({ offset, animated: smooth = true }) =>
        inner.current?.scrollTo(
          horizontal
            ? { left: offset, behavior: behavior(smooth) }
            : { top: offset, behavior: behavior(smooth) },
        ),
      scrollToIndex: ({ index, animated: smooth = true }) => {
        const cell = content.current?.querySelector(`[data-index="${index}"]`);
        if (!cell) return;
        inner.current?.scrollTo(
          horizontal
            ? { left: cell.offsetLeft, behavior: behavior(smooth) }
            : { top: cell.offsetTop, behavior: behavior(smooth) },
        );
      },
      scrollToEnd: ({ animated: smooth = true } = {}) => {
        const el = inner.current;
        if (!el) return;
        el.scrollTo(
          horizontal
            ? { left: el.scrollWidth, behavior: behavior(smooth) }
            : { top: el.scrollHeight, behavior: behavior(smooth) },
        );
      },
    }),
    [horizontal],
  );
  const handleScroll = (event: { currentTarget: Scroller }) => {
    const el = event.currentTarget;
    onScroll?.({ x: el.scrollLeft, y: el.scrollTop });
    if (!onEndReached) return;
    const remaining = horizontal
      ? el.scrollWidth - el.scrollLeft - el.clientWidth
      : el.scrollHeight - el.scrollTop - el.clientHeight;
    const visible = horizontal ? el.clientWidth : el.clientHeight;
    if (remaining <= onEndReachedThreshold * visible) {
      if (!nearEnd.current) {
        nearEnd.current = true;
        onEndReached();
      }
    } else {
      nearEnd.current = false;
    }
  };
  const cells: ReactNode[] = [];
  data.forEach((item, index) => {
    const key = keyExtractor(item, index);
    if (index > 0 && separator !== undefined) {
      cells.push(
        createElement("div", { key: `${key}:sep`, ...stylex.props(base.view) }, separator),
      );
    }
    cells.push(
      createElement(
        "div",
        { key, "data-index": index, ...stylex.props(base.view) },
        renderItem({ item, index }),
      ),
    );
  });
  return createElement(
    "div",
    {
      ...rest,
      ref: inner,
      "data-testid": testID,
      onScroll: onScroll || onEndReached ? handleScroll : undefined,
      ...stylex.props(base.view, base.scroll, horizontal && base.scrollHorizontal, sx),
    },
    createElement(
      "div",
      { ref: content, ...stylex.props(base.view, horizontal && base.contentHorizontal, contentSx) },
      header,
      data.length === 0 ? empty : cells,
      footer,
    ),
  );
}
