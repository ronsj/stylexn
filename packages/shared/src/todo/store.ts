// The todo list's state: a pure reducer plus the derived view (filter and
// pagination), and persistence against `localStorage`. No React, no styles.

export type Todo = Readonly<{ id: string; title: string; done: boolean; createdAt: number }>;

export type Filter = "all" | "active" | "done";
export const FILTERS: readonly Filter[] = ["all", "active", "done"];

export const PAGE_SIZE = 5;
export const STORAGE_KEY = "stylexn-todos";

export type State = Readonly<{
  todos: readonly Todo[];
  filter: Filter;
  /** 1-based; always within the filtered list's page range. */
  page: number;
  /** True once the saved todos have been loaded, so an empty first render never overwrites them. */
  hydrated: boolean;
}>;

export type Action =
  | Readonly<{ type: "load"; todos: readonly Todo[] }>
  | Readonly<{ type: "add"; id: string; title: string; createdAt: number }>
  | Readonly<{ type: "toggle"; id: string }>
  | Readonly<{ type: "edit"; id: string; title: string }>
  | Readonly<{ type: "remove"; id: string }>
  | Readonly<{ type: "setFilter"; filter: Filter }>
  | Readonly<{ type: "setPage"; page: number }>;

export const initialState: State = { todos: [], filter: "all", page: 1, hydrated: false };

export function matches(todo: Todo, filter: Filter): boolean {
  return filter === "all" || (filter === "done") === todo.done;
}

export function filtered(state: Pick<State, "todos" | "filter">): readonly Todo[] {
  return state.todos.filter((todo) => matches(todo, state.filter));
}

export function pageCount(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
}

const clamp = (page: number, count: number) =>
  Math.min(Math.max(1, Math.trunc(page) || 1), pageCount(count));

/** Keep the page inside the range of the filtered list. */
function normalise(state: State): State {
  const page = clamp(state.page, filtered(state).length);
  return page === state.page ? state : { ...state, page };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return normalise({ ...state, todos: action.todos, hydrated: true });
    case "add": {
      const title = action.title.trim();
      if (!title) return state;
      const todo: Todo = { id: action.id, title, done: false, createdAt: action.createdAt };
      // Newest first, on page 1; a "done" filter would hide the new todo.
      return {
        ...state,
        todos: [todo, ...state.todos],
        filter: state.filter === "done" ? "all" : state.filter,
        page: 1,
      };
    }
    case "toggle":
      return normalise({
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      });
    case "edit": {
      const title = action.title.trim();
      // Empty text cancels the edit.
      if (!title) return state;
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, title } : t)),
      };
    }
    case "remove":
      // Removing the last todo of the last page moves back a page.
      return normalise({ ...state, todos: state.todos.filter((t) => t.id !== action.id) });
    case "setFilter":
      return { ...state, filter: action.filter, page: 1 };
    case "setPage":
      return normalise({ ...state, page: action.page });
  }
}

export type View = Readonly<{
  /** The todos on the current page. */
  items: readonly Todo[];
  page: number;
  pageCount: number;
  /** Todos matching the filter, across all pages. */
  total: number;
  counts: Readonly<Record<Filter, number>>;
}>;

export function view(state: State): View {
  const list = filtered(state);
  const page = clamp(state.page, list.length);
  const done = state.todos.filter((t) => t.done).length;
  return {
    items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page,
    pageCount: pageCount(list.length),
    total: list.length,
    counts: { all: state.todos.length, active: state.todos.length - done, done },
  };
}

let counter = 0;
/** A unique enough id for a local list. */
export function newId(now = Date.now()): string {
  counter += 1;
  return `${now.toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** The part of the Web Storage API this uses (React Native has no DOM types). */
export type Storage = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

/**
 * `localStorage` when this platform has one: browsers, and React Native once
 * `expo-sqlite/localStorage/install` has run. Not during server prerendering.
 * Read through `globalThis` because React Native's types do not declare it;
 * a browser with storage blocked throws on access.
 */
function storage(): Storage | null {
  try {
    const { localStorage } = globalThis as { localStorage?: Storage };
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function isTodo(value: unknown): value is Todo {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.done === "boolean" &&
    typeof t.createdAt === "number"
  );
}

/** The saved todos; an empty list when nothing (valid) is stored. */
export function load(store: Storage | null = storage()): Todo[] {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isTodo) : [];
  } catch {
    return [];
  }
}

export function save(todos: readonly Todo[], store: Storage | null = storage()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // Storage full or unavailable: the list still works for this session.
  }
}
