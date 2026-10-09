"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import * as stylex from "stylexn";
import { web } from "stylexn";
import { Switch, Text, View } from "stylexn/elements";
import { Filters } from "./Filters";
import { Pagination } from "./Pagination";
import { initialState, load, newId, reducer, save, view, type Filter } from "./store";
import { TodoInput } from "./TodoInput";
import { TodoList, type Direction } from "./TodoList";
import { colors, radii, space } from "./tokens.stylex";

// A small todo app written once for web (StyleX + DOM) and native (the
// StyleXN runtime + React Native). Each style below notes the StyleXN
// feature it shows.

const DARK = "@media (prefers-color-scheme: dark)";
const WIDE = "@media (min-width: 640px)";

/** How long the delete transition runs; matches `transitionDuration` on TodoItem's row. */
const REMOVE_MS = 250;

// createTheme: new values for the accent variables. In `sx` a theme reaches
// the element and everything inside it, on both platforms.
const teal = stylex.createTheme(colors, {
  accent: { default: "#0f766e", [DARK]: "#2dd4bf" },
  accentHover: { default: "#138a80", [DARK]: "#5eead4" },
  accentPressed: { default: "#0b5a54", [DARK]: "#14b8a6" },
  accentSoft: { default: "#e3f4f2", [DARK]: "#163330" },
});

const styles = stylex.create({
  screen: {
    // Fills the screen on native (the app root) and the page on the web.
    flexGrow: 1,
    width: "100%",
    // firstThatWorks: the web gets 100dvh where the browser has it, 100vh
    // otherwise. Native keeps the first candidate the compat table accepts,
    // 100dvh (treated as 100vh); flexGrow already fills the screen there.
    minHeight: stylex.firstThatWorks("100dvh", "100vh"),
    // Native text uses the platform font (San Francisco, Roboto). On the web
    // Text inherits the page's font, so give the root the same system stack
    // in web(): a family name is web-only, native must not see it.
    ...web({
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }),
    alignItems: "center",
    backgroundColor: colors.background,
    // env(safe-area-inset-*) inside calc(): clear of the notch and home
    // indicator; SafeAreaInsetsProvider supplies the insets on native.
    paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
    paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
    paddingLeft: "calc(1rem + env(safe-area-inset-left))",
    paddingRight: "calc(1rem + env(safe-area-inset-right))",
  },
  card: {
    width: "100%",
    // rem: relative to the root font size (16px on native).
    maxWidth: "36rem",
    // @media (min-width): more room on wide windows.
    padding: { default: space.lg, [WIDE]: space.xl },
    gap: space.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    boxShadow: "0 8px 24px rgba(31, 27, 38, 0.08)",
  },
  header: {
    // @media (min-width): stacked on phones, side by side on wide windows.
    flexDirection: { default: "column", [WIDE]: "row" },
    alignItems: { default: "flex-start", [WIDE]: "center" },
    justifyContent: "space-between",
    gap: space.md,
  },
  title: {
    // clamp() with vw: the heading grows with the window between two sizes.
    fontSize: "clamp(1.75rem, 1rem + 4vw, 2.25rem)",
    fontWeight: 800,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 1.5,
    // lh: half a line of this rule's own line height, for vertical rhythm.
    marginTop: "0.25lh",
    color: colors.muted,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    fontSize: 14,
    color: colors.muted,
  },
  // :checked on a Switch comes from its `value` prop on native.
  themeSwitch: {
    transform: { default: "scale(0.9)", ":checked": "scale(1)" },
    transitionProperty: "transform",
    transitionDuration: "200ms",
  },
  toolbar: {
    // @media (min-width): the summary moves beside the filters.
    flexDirection: { default: "column", [WIDE]: "row" },
    alignItems: { default: "stretch", [WIDE]: "center" },
    justifyContent: "space-between",
    gap: space.sm,
  },
  summary: {
    fontSize: 14,
    color: colors.muted,
  },
});

export function TodoApp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [removing, setRemoving] = useState<ReadonlySet<string>>(() => new Set());
  const [added, setAdded] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("forward");
  const [alt, setAlt] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Hydrate after mount: the web page is prerendered without localStorage.
  useEffect(() => {
    dispatch({ type: "load", todos: load() });
  }, []);
  useEffect(() => {
    if (state.hydrated) save(state.todos);
  }, [state.hydrated, state.todos]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const v = view(state);

  const add = (title: string) => {
    const id = newId();
    if (v.page !== 1) setDirection("back");
    setAdded(id);
    dispatch({ type: "add", id, title, createdAt: Date.now() });
  };

  // The row animates out first; the todo leaves the state when that is done.
  const remove = (id: string) => {
    if (timers.current.has(id)) return;
    setRemoving((ids) => new Set(ids).add(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setRemoving((ids) => {
          const next = new Set(ids);
          next.delete(id);
          return next;
        });
        dispatch({ type: "remove", id });
      }, REMOVE_MS),
    );
  };

  const setPage = (page: number) => {
    setDirection(page > v.page ? "forward" : "back");
    setAdded(null);
    dispatch({ type: "setPage", page });
  };

  const setFilter = (filter: Filter) => {
    setDirection("forward");
    setAdded(null);
    dispatch({ type: "setFilter", filter });
  };

  return (
    <View sx={[alt && teal, styles.screen]}>
      <View sx={styles.card}>
        <View sx={styles.header}>
          <View>
            <Text sx={styles.title} role="heading">
              Todos
            </Text>
            <Text sx={styles.subtitle}>One StyleXN codebase, on the web and on native.</Text>
          </View>
          <View sx={styles.themeRow}>
            <Text>Teal accent</Text>
            <Switch
              sx={styles.themeSwitch}
              value={alt}
              onValueChange={setAlt}
              aria-label="Teal accent"
              testID="theme-toggle"
            />
          </View>
        </View>
        <TodoInput onAdd={add} />
        <View sx={styles.toolbar}>
          <Filters filter={state.filter} counts={v.counts} onChange={setFilter} />
          <Text sx={styles.summary} testID="todo-summary">
            {`${v.counts.active} left · ${v.counts.done} done`}
          </Text>
        </View>
        {/* A new key per page and filter remounts the list, so its entry animation plays. */}
        <TodoList
          key={`${state.filter}:${v.page}`}
          items={v.items}
          filter={state.filter}
          direction={direction}
          removing={removing}
          added={added}
          onToggle={(id) => dispatch({ type: "toggle", id })}
          onEdit={(id, title) => dispatch({ type: "edit", id, title })}
          onRemove={remove}
        />
        <Pagination page={v.page} pageCount={v.pageCount} onChange={setPage} />
      </View>
    </View>
  );
}
