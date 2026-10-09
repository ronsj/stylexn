import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AccessibilityInfo, Appearance, Dimensions } from "react-native";
import { useMotion, type AnimatedStyle } from "./animated.ts";
import type { CompiledRule } from "../compile/compile.ts";
import {
  colorScheme,
  config,
  DEFAULT_ACCESSIBILITY,
  getAccessibility,
  platform,
  setAccessibility,
  windowMetrics,
  type Accessibility,
} from "./env.ts";
import { registerInherit, shallowEqual, type InheritedTextStyle } from "./inherit.ts";
import { analyzeNeeds, flattenArgs, resolve } from "./resolve.ts";
import type { Env, InteractionState, StyleArg, Theme, VarScope, WindowMetrics } from "./types.ts";
import { scopeWith } from "./vars.ts";

// ---------------------------------------------------------------------------
// External stores: subscribed to only when a rule needs them.
// ---------------------------------------------------------------------------

let windowSnapshot: WindowMetrics | null = null;

function subscribeWindow(onChange: () => void): () => void {
  const sub = Dimensions.addEventListener("change", () => {
    windowSnapshot = null;
    onChange();
  });
  return () => sub.remove();
}

function getWindow(): WindowMetrics {
  windowSnapshot ??= windowMetrics();
  return windowSnapshot;
}

function subscribeColorScheme(onChange: () => void): () => void {
  const sub = Appearance.addChangeListener(onChange);
  return () => sub.remove();
}

// ---------------------------------------------------------------------------
// Accessibility settings: reduced motion, contrast, reduced transparency and
// inverted colours share one store (one useSyncExternalStore slot per
// element). Each setting has its own subscriber set, and its native listener
// is attached (and its initial value read) only while an element needs it.
// ---------------------------------------------------------------------------

type Remove = () => void;
type Setting = Readonly<{
  /** Read the current value and listen for changes; null where the platform has no such setting. */
  attach: (apply: (on: boolean) => void) => Remove | null;
  patch: (on: boolean) => Partial<Accessibility>;
}>;

const listen = (
  read: () => Promise<boolean>,
  add: (cb: (on: boolean) => void) => { remove(): void },
  apply: (on: boolean) => void,
): Remove => {
  read().then(apply, () => {}); // a method for the other platform may reject
  const sub = add(apply);
  return () => sub.remove();
};

// Bit order: reducedMotion, contrast, reducedTransparency, invertedColors.
const SETTINGS: readonly Setting[] = [
  {
    attach: (apply) =>
      listen(
        () => AccessibilityInfo.isReduceMotionEnabled(),
        (cb) => AccessibilityInfo.addEventListener("reduceMotionChanged", cb),
        apply,
      ),
    patch: (on) => ({ reducedMotion: on }),
  },
  {
    attach: (apply) =>
      platform() === "android"
        ? listen(
            () => AccessibilityInfo.isHighTextContrastEnabled(),
            (cb) => AccessibilityInfo.addEventListener("highTextContrastChanged", cb),
            apply,
          )
        : listen(
            () => AccessibilityInfo.isDarkerSystemColorsEnabled(),
            (cb) => AccessibilityInfo.addEventListener("darkerSystemColorsChanged", cb),
            apply,
          ),
    patch: (on) => ({ contrast: on ? "more" : "no-preference" }),
  },
  {
    attach: (apply) =>
      platform() === "android"
        ? null
        : listen(
            () => AccessibilityInfo.isReduceTransparencyEnabled(),
            (cb) => AccessibilityInfo.addEventListener("reduceTransparencyChanged", cb),
            apply,
          ),
    patch: (on) => ({ reducedTransparency: on }),
  },
  {
    attach: (apply) =>
      platform() === "android"
        ? null
        : listen(
            () => AccessibilityInfo.isInvertColorsEnabled(),
            (cb) => AccessibilityInfo.addEventListener("invertColorsChanged", cb),
            apply,
          ),
    patch: (on) => ({ invertedColors: on }),
  },
];

const settingSubscribers = SETTINGS.map(() => new Set<() => void>());
const settingRemove: (Remove | null)[] = SETTINGS.map(() => null);

function applySetting(bit: number, on: boolean): void {
  if (!setAccessibility((SETTINGS[bit] as Setting).patch(on))) return;
  for (const cb of settingSubscribers[bit] as Set<() => void>) cb();
}

function subscribeSetting(bit: number, onChange: () => void): void {
  const subscribers = settingSubscribers[bit] as Set<() => void>;
  subscribers.add(onChange);
  if (subscribers.size === 1) {
    settingRemove[bit] = (SETTINGS[bit] as Setting).attach((on) => applySetting(bit, on));
  }
}

function unsubscribeSetting(bit: number, onChange: () => void): void {
  const subscribers = settingSubscribers[bit] as Set<() => void>;
  subscribers.delete(onChange);
  if (subscribers.size === 0) {
    settingRemove[bit]?.();
    settingRemove[bit] = null;
  }
}

/** One subscribe function per combination of needed settings, so its identity is stable. */
const accessibilitySubscribers: ((onChange: () => void) => () => void)[] = [];

function subscribeAccessibility(mask: number): (onChange: () => void) => () => void {
  let subscribe = accessibilitySubscribers[mask];
  if (!subscribe) {
    subscribe = (onChange) => {
      for (let bit = 0; bit < SETTINGS.length; bit++) {
        if (mask & (1 << bit)) subscribeSetting(bit, onChange);
      }
      return () => {
        for (let bit = 0; bit < SETTINGS.length; bit++) {
          if (mask & (1 << bit)) unsubscribeSetting(bit, onChange);
        }
      };
    };
    accessibilitySubscribers[mask] = subscribe;
  }
  return subscribe;
}

const getDefaultAccessibility = () => DEFAULT_ACCESSIBILITY;

// Stable subscribe/snapshot functions for stores a rule does not need: a
// new getSnapshot identity per render makes useSyncExternalStore schedule a
// passive effect on every element every render.
const noop = () => () => {};
const getNull = () => null;

// ---------------------------------------------------------------------------
// Theme context
// ---------------------------------------------------------------------------

const VarsContext = createContext<VarScope>({});
const TextStyleContext = createContext<InheritedTextStyle>({});

export type ThemeProviderProps = Readonly<{
  theme: Theme | readonly Theme[];
  children?: ReactNode;
}>;

/** Apply `createTheme` overrides to a subtree (the native stand-in for CSS variable scoping). */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const parent = useContext(VarsContext);
  const value = useMemo(
    () => scopeWith(parent, Array.isArray(theme) ? (theme as readonly Theme[]) : [theme as Theme]),
    [parent, theme],
  );
  return createElement(VarsContext.Provider, { value }, children);
}

/** Keep the previous object while the new one is shallow-equal, so context consumers do not re-render. */
function useShallowStable<T extends Readonly<Record<string, unknown>>>(value: T): T {
  const [stable, setStable] = useState(value);
  if (stable === value || shallowEqual(stable, value)) return stable;
  setStable(value); // derived state: React re-renders once with the new object
  return value;
}

export type TextStyleProviderProps = Readonly<{
  /** Inherited text properties (see INHERITED_TEXT_KEYS) for the subtree; merged over the parent's. */
  style: InheritedTextStyle;
  children?: ReactNode;
}>;

/**
 * The native stand-in for CSS text inheritance: `color`, `fontSize`, ... set
 * on a View reach nested Text through this context. `em` units resolve
 * against its `fontSize`.
 */
export function TextStyleProvider({ style, children }: TextStyleProviderProps) {
  const parent = useContext(TextStyleContext);
  const stable = useShallowStable(style);
  const value = useMemo(() => ({ ...parent, ...stable }), [parent, stable]);
  return createElement(TextStyleContext.Provider, { value }, children);
}

/** Text properties inherited from enclosing elements. */
export function useInheritedTextStyle(): InheritedTextStyle {
  return useContext(TextStyleContext);
}

/** Provide the inherited font size for `em` units in a subtree. */
export function FontSizeProvider({
  fontSize,
  children,
}: {
  fontSize: number;
  children?: ReactNode;
}) {
  const style = useMemo(() => ({ fontSize }), [fontSize]);
  return createElement(TextStyleProvider, { style }, children);
}

// ---------------------------------------------------------------------------
// Interaction state
// ---------------------------------------------------------------------------

export type InteractionHandlers = Readonly<{
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onFocus: () => void;
  onBlur: () => void;
}>;

/** Track hover/active/focus for `:hover`, `:active`, `:focus` conditions. Spread the handlers on a Pressable. */
export function useInteraction(): [InteractionState, InteractionHandlers] {
  const [state, setState] = useState<InteractionState>(NO_INTERACTION);
  const handlers = useMemo<InteractionHandlers>(() => {
    const set = (patch: InteractionState) => setState((s) => ({ ...s, ...patch }));
    return {
      onHoverIn: () => set({ hover: true }),
      onHoverOut: () => set({ hover: false }),
      onPressIn: () => set({ active: true }),
      onPressOut: () => set({ active: false }),
      onFocus: () => set({ focus: true }),
      onBlur: () => set({ focus: false }),
    };
  }, []);
  return [state, handlers];
}
const NO_INTERACTION: InteractionState = {};

// ---------------------------------------------------------------------------
// useProps
// ---------------------------------------------------------------------------

export type UsePropsOptions = Readonly<{
  /** Interaction state supplied by the caller (e.g. from a Pressable's render prop). */
  interaction?: InteractionState;
  /** `:disabled` / `:enabled`. */
  disabled?: boolean;
  /** `:checked`. */
  checked?: boolean;
  /** `:placeholder-shown`. */
  placeholderShown?: boolean;
  /** `:read-only` / `:read-write` (a disabled element is read-only too). */
  readOnly?: boolean;
}>;

export type UsePropsResult = Readonly<{
  /** May hold Animated nodes when `animated` is set; render on Animated.View/Text then. */
  style: AnimatedStyle;
  /** Set (true) when the rules mention motion: render on an Animated component then. */
  animated?: true;
  [prop: string]: unknown;
}> &
  Partial<InteractionHandlers>;

/**
 * `props()` for components: subscribes to dimensions, color scheme,
 * accessibility settings and theme context only when the rules need them, and returns
 * interaction handlers when a rule has `:hover`/`:active`/`:focus`.
 */
export function useProps(args: readonly StyleArg[], options: UsePropsOptions = {}): UsePropsResult {
  // Per-rule analysis is cached on the rules, so this is cheap every render
  // (the args array is usually new each time, which defeats useMemo).
  const needs = analyzeNeeds(flattenArgs(args).rules);

  const window = useSyncExternalStore(
    needs.dimensions ? subscribeWindow : noop,
    needs.dimensions ? getWindow : getNull,
  );
  const scheme = useSyncExternalStore(
    needs.colorScheme ? subscribeColorScheme : noop,
    needs.colorScheme ? colorScheme : getNull,
  );
  const a11yMask =
    (needs.reducedMotion ? 1 : 0) |
    (needs.contrast ? 2 : 0) |
    (needs.reducedTransparency ? 4 : 0) |
    (needs.invertedColors ? 8 : 0);
  const accessibility = useSyncExternalStore(
    a11yMask === 0 ? noop : subscribeAccessibility(a11yMask),
    a11yMask === 0 ? getDefaultAccessibility : getAccessibility,
  );
  const vars = useContext(VarsContext);
  const inheritedFontSize = useContext(TextStyleContext).fontSize;
  const [ownInteraction, handlers] = useInteraction();

  const env: Env = {
    window: window ?? getWindow(),
    colorScheme: scheme ?? colorScheme(),
    reducedMotion: accessibility.reducedMotion,
    contrast: accessibility.contrast,
    reducedTransparency: accessibility.reducedTransparency,
    invertedColors: accessibility.invertedColors,
    pointer: config.pointer,
    interaction: needs.interaction
      ? {
          ...ownInteraction,
          ...options.interaction,
          // Element state from props; a top-level option wins over `interaction`.
          disabled: options.disabled ?? options.interaction?.disabled,
          checked: options.checked ?? options.interaction?.checked,
          placeholderShown: options.placeholderShown ?? options.interaction?.placeholderShown,
          readOnly: options.readOnly ?? options.interaction?.readOnly,
        }
      : NO_INTERACTION,
    vars,
    rootFontSize: config.rootFontSize,
    fontSize: typeof inheritedFontSize === "number" ? inheritedFontSize : config.fontSize,
    platform: platform(),
  };
  const { style, props: extra, transition, animations, inherit } = resolve(args, env);
  const motion = useMotion(
    style,
    { transition, animations },
    env,
    needs.motion,
    (rule: CompiledRule) => resolve([rule], env).style,
  );
  const result: Record<string, unknown> = { ...extra };
  if (needs.interaction) Object.assign(result, handlers);
  if (motion.animated) result.animated = true;
  if (inherit) registerInherit(motion.style, inherit);
  result.style = motion.style;
  return result as UsePropsResult;
}
