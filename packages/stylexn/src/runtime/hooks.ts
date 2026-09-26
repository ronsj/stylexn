import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AccessibilityInfo, Appearance, Dimensions } from "react-native";
import type { Props } from "./api.ts";
import { colorScheme, config, getReducedMotion, setReducedMotion, windowMetrics } from "./env.ts";
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

function subscribeReducedMotion(onChange: () => void): () => void {
  AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
    if (enabled !== getReducedMotion()) {
      setReducedMotion(enabled);
      onChange();
    }
  });
  const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
    setReducedMotion(enabled);
    onChange();
  });
  return () => sub.remove();
}

const noop = () => () => {};

// ---------------------------------------------------------------------------
// Theme context
// ---------------------------------------------------------------------------

const VarsContext = createContext<VarScope>({});
const FontSizeContext = createContext<number | null>(null);

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

/** Provide the inherited font size for `em` units in a subtree. */
export function FontSizeProvider({
  fontSize,
  children,
}: {
  fontSize: number;
  children?: ReactNode;
}) {
  return createElement(FontSizeContext.Provider, { value: fontSize }, children);
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
  const [state, setState] = useState<InteractionState>({});
  const set = useCallback((patch: InteractionState) => setState((s) => ({ ...s, ...patch })), []);
  const handlers = useMemo<InteractionHandlers>(
    () => ({
      onHoverIn: () => set({ hover: true }),
      onHoverOut: () => set({ hover: false }),
      onPressIn: () => set({ active: true }),
      onPressOut: () => set({ active: false }),
      onFocus: () => set({ focus: true }),
      onBlur: () => set({ focus: false }),
    }),
    [set],
  );
  return [state, handlers];
}

// ---------------------------------------------------------------------------
// useProps
// ---------------------------------------------------------------------------

export type UsePropsOptions = Readonly<{
  /** Interaction state supplied by the caller (e.g. from a Pressable's render prop). */
  interaction?: InteractionState;
  disabled?: boolean;
}>;

/**
 * `props()` for components: subscribes to dimensions, color scheme, reduced
 * motion and theme context only when the rules need them, and returns
 * interaction handlers when a rule has `:hover`/`:active`/`:focus`.
 */
export function useProps(
  args: readonly StyleArg[],
  options: UsePropsOptions = {},
): Props & Partial<InteractionHandlers> {
  const needs = useMemo(() => analyzeNeeds(flattenArgs(args).rules), [args]);

  const window = useSyncExternalStore(
    needs.dimensions ? subscribeWindow : noop,
    needs.dimensions ? getWindow : () => null,
  );
  const scheme = useSyncExternalStore(
    needs.colorScheme ? subscribeColorScheme : noop,
    needs.colorScheme ? colorScheme : () => null,
  );
  const reducedMotion = useSyncExternalStore(
    needs.reducedMotion ? subscribeReducedMotion : noop,
    needs.reducedMotion ? getReducedMotion : () => false,
  );
  const vars = useContext(VarsContext);
  const inheritedFontSize = useContext(FontSizeContext);
  const [ownInteraction, handlers] = useInteraction();

  const env: Env = {
    window: window ?? getWindow(),
    colorScheme: scheme ?? colorScheme(),
    reducedMotion,
    pointer: config.pointer,
    interaction: { ...ownInteraction, ...options.interaction, disabled: options.disabled },
    vars,
    rootFontSize: config.rootFontSize,
    fontSize: inheritedFontSize ?? config.fontSize,
    platform: "ios",
  };
  const { style, props: extra } = resolve(args, env);
  return needs.interaction ? { ...extra, ...handlers, style } : { ...extra, style };
}
