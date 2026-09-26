/**
 * Props shared by the web and native implementations of the elements, so a
 * component in packages/shared type-checks the same way whichever entry the
 * editor resolves. Accessibility props follow the web names; React Native
 * accepts this subset natively (`role` and `aria-*` since 0.71), so nothing
 * is renamed on either side.
 */

import type { ReactNode } from "react";

/** Roles React Native understands; a subset of WAI-ARIA. */
export type Role =
  | "alert"
  | "alertdialog"
  | "application"
  | "article"
  | "banner"
  | "button"
  | "cell"
  | "checkbox"
  | "columnheader"
  | "combobox"
  | "complementary"
  | "contentinfo"
  | "definition"
  | "dialog"
  | "directory"
  | "document"
  | "feed"
  | "figure"
  | "form"
  | "grid"
  | "group"
  | "heading"
  | "img"
  | "link"
  | "list"
  | "listitem"
  | "log"
  | "main"
  | "marquee"
  | "math"
  | "menu"
  | "menubar"
  | "menuitem"
  | "meter"
  | "navigation"
  | "none"
  | "note"
  | "option"
  | "presentation"
  | "progressbar"
  | "radio"
  | "radiogroup"
  | "region"
  | "row"
  | "rowgroup"
  | "rowheader"
  | "scrollbar"
  | "searchbox"
  | "separator"
  | "slider"
  | "spinbutton"
  | "status"
  | "summary"
  | "switch"
  | "tab"
  | "table"
  | "tablist"
  | "tabpanel"
  | "term"
  | "timer"
  | "toolbar"
  | "tooltip"
  | "tree"
  | "treegrid"
  | "treeitem";

export type A11yProps = Readonly<{
  role?: Role;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-hidden"?: boolean;
  "aria-live"?: "polite" | "assertive" | "off";
  "aria-busy"?: boolean;
  "aria-checked"?: boolean | "mixed";
  "aria-disabled"?: boolean;
  "aria-expanded"?: boolean;
  "aria-selected"?: boolean;
  "aria-modal"?: boolean;
  "aria-valuemax"?: number;
  "aria-valuemin"?: number;
  "aria-valuenow"?: number;
  "aria-valuetext"?: string;
}>;

/** Props every element takes, besides `sx`. */
export type CommonProps = A11yProps & Readonly<{ testID?: string }>;

/**
 * A URL or data URI, a bundler `require()` result (a number under Metro, a
 * `{ src }` object under Next, a string under webpack), or a `{ uri }` object.
 */
export type ImageSource = string | number | Readonly<{ uri?: string; src?: string }>;

export type ImageOwnProps = Readonly<{
  src: ImageSource;
  /** Accessible description; empty string for decorative images. */
  alt: string;
  onLoad?: () => void;
  onError?: () => void;
}>;

export type KeyboardType =
  | "default"
  | "email-address"
  | "numeric"
  | "decimal-pad"
  | "phone-pad"
  | "url";
export type ReturnKeyType = "done" | "go" | "next" | "search" | "send";

export type TextInputOwnProps = Readonly<{
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  /** Return/Enter pressed on a single-line input. */
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Password entry. */
  secureTextEntry?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Web: `inputMode` and `type`. */
  keyboardType?: KeyboardType;
  /** Web: `enterKeyHint`. */
  returnKeyType?: ReturnKeyType;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  maxLength?: number;
}>;

export type PressableOwnProps = Readonly<{
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  /** Held for 500ms; `onPress` does not fire for that press. */
  onLongPress?: () => void;
}>;

export type SwitchOwnProps = Readonly<{
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
}>;

export type ScrollEvent = Readonly<{ x: number; y: number }>;

export type ScrollViewOwnProps = Readonly<{
  horizontal?: boolean;
  /** Content offset on every scroll event. */
  onScroll?: (event: ScrollEvent) => void;
}>;

/** Methods on a `TextInput` ref. */
export type TextInputHandle = Readonly<{
  focus(): void;
  blur(): void;
  /** Empty the field (reports "" through `onChangeText`). */
  clear(): void;
}>;

/** Methods on a `ScrollView` ref. Scrolling animates unless `animated` is false. */
export type ScrollViewHandle = Readonly<{
  scrollTo(offset: Readonly<{ x?: number; y?: number; animated?: boolean }>): void;
  scrollToEnd(options?: Readonly<{ animated?: boolean }>): void;
}>;

/** Methods on a `FlatList` ref. Offsets are along the scroll axis. */
export type FlatListHandle = Readonly<{
  scrollToOffset(options: Readonly<{ offset: number; animated?: boolean }>): void;
  scrollToIndex(options: Readonly<{ index: number; animated?: boolean }>): void;
  scrollToEnd(options?: Readonly<{ animated?: boolean }>): void;
}>;

export type FlatListOwnProps<T> = Readonly<{
  data: readonly T[];
  renderItem: (info: Readonly<{ item: T; index: number }>) => ReactNode;
  /** Defaults to the item's `key`, then `id`, then the index. */
  keyExtractor?: (item: T, index: number) => string;
  /** Rendered above the items, scrolling with them. */
  header?: ReactNode;
  /** Rendered below the items, scrolling with them. */
  footer?: ReactNode;
  /** Rendered instead of the items when `data` is empty. */
  empty?: ReactNode;
  /** Rendered between items. */
  separator?: ReactNode;
  horizontal?: boolean;
  onScroll?: (event: ScrollEvent) => void;
  /** Called once when the end of the content comes within `onEndReachedThreshold` visible lengths. */
  onEndReached?: () => void;
  /** In visible lengths of the list; React Native's default is 2. */
  onEndReachedThreshold?: number;
}>;
