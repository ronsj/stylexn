/**
 * Props shared by the web and native implementations of the elements, so a
 * component in packages/shared type-checks the same way whichever entry the
 * editor resolves. Accessibility props follow the web names; React Native
 * accepts this subset natively (`role` and `aria-*` since 0.71), so nothing
 * is renamed on either side.
 */

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

export type ImageOwnProps = Readonly<{
  /** URL or data URI. Native wraps it as `{ uri }`. */
  src: string;
  /** Accessible description; empty string for decorative images. */
  alt: string;
}>;

export type TextInputOwnProps = Readonly<{
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  /** Password entry. */
  secureTextEntry?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}>;

export type ScrollViewOwnProps = Readonly<{
  horizontal?: boolean;
}>;
