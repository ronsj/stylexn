import { describe, expect, test } from "vitest";
import {
  PAGE_SIZE,
  STORAGE_KEY,
  initialState,
  load,
  newId,
  reducer,
  save,
  view,
  type Action,
  type State,
  type Storage,
} from "./store";

const run = (actions: readonly Action[], state: State = initialState) =>
  actions.reduce(reducer, state);

const adds = (n: number, from = 1): Action[] =>
  Array.from({ length: n }, (_, i) => ({
    type: "add",
    id: `t${from + i}`,
    title: `Todo ${from + i}`,
    createdAt: from + i,
  }));

const titles = (state: State) => view(state).items.map((t) => t.title);

describe("reducer", () => {
  test("add trims, ignores empty titles and puts the newest first", () => {
    const state = run([
      { type: "add", id: "a", title: "  First  ", createdAt: 1 },
      { type: "add", id: "b", title: "   ", createdAt: 2 },
      { type: "add", id: "c", title: "Second", createdAt: 3 },
    ]);
    expect(state.todos).toEqual([
      { id: "c", title: "Second", done: false, createdAt: 3 },
      { id: "a", title: "First", done: false, createdAt: 1 },
    ]);
  });

  test("toggle, edit and remove act on one todo", () => {
    let state = run(adds(2));
    state = reducer(state, { type: "toggle", id: "t1" });
    expect(state.todos.find((t) => t.id === "t1")?.done).toBe(true);
    state = reducer(state, { type: "edit", id: "t2", title: " Renamed " });
    expect(state.todos.find((t) => t.id === "t2")?.title).toBe("Renamed");
    // Empty text cancels the edit.
    expect(reducer(state, { type: "edit", id: "t2", title: "  " })).toBe(state);
    state = reducer(state, { type: "remove", id: "t1" });
    expect(state.todos.map((t) => t.id)).toEqual(["t2"]);
  });

  test("filters by done state and counts each filter", () => {
    const state = run([...adds(3), { type: "toggle", id: "t2" }]);
    expect(view(state).counts).toEqual({ all: 3, active: 2, done: 1 });
    expect(titles(run([{ type: "setFilter", filter: "active" }], state))).toEqual([
      "Todo 3",
      "Todo 1",
    ]);
    expect(titles(run([{ type: "setFilter", filter: "done" }], state))).toEqual(["Todo 2"]);
  });

  test("paginates five per page and clamps the page", () => {
    let state = run(adds(PAGE_SIZE + 2));
    expect(view(state)).toMatchObject({ page: 1, pageCount: 2, total: 7 });
    expect(titles(state)).toEqual(["Todo 7", "Todo 6", "Todo 5", "Todo 4", "Todo 3"]);
    state = reducer(state, { type: "setPage", page: 2 });
    expect(titles(state)).toEqual(["Todo 2", "Todo 1"]);
    expect(reducer(state, { type: "setPage", page: 9 }).page).toBe(2);
    expect(reducer(state, { type: "setPage", page: 0 }).page).toBe(1);
  });

  test("removing the last todo of the last page moves back a page", () => {
    let state = run([...adds(PAGE_SIZE + 1), { type: "setPage", page: 2 }]);
    expect(titles(state)).toEqual(["Todo 1"]);
    state = reducer(state, { type: "remove", id: "t1" });
    expect(state.page).toBe(1);
    expect(view(state)).toMatchObject({ page: 1, pageCount: 1 });
  });

  test("toggling the last match of the last page out of the filter moves back a page", () => {
    let state = run([
      ...adds(PAGE_SIZE + 1),
      { type: "setFilter", filter: "active" },
      { type: "setPage", page: 2 },
    ]);
    state = reducer(state, { type: "toggle", id: "t1" });
    expect(state.page).toBe(1);
  });

  test("changing the filter resets to page 1", () => {
    const state = run([...adds(PAGE_SIZE + 1), { type: "setPage", page: 2 }]);
    expect(reducer(state, { type: "setFilter", filter: "active" }).page).toBe(1);
  });

  test("adding goes to page 1 and leaves a done filter so the new todo shows", () => {
    const state = run([
      ...adds(PAGE_SIZE + 1),
      { type: "setPage", page: 2 },
      { type: "setFilter", filter: "done" },
      ...adds(1, 100),
    ]);
    expect(state).toMatchObject({ page: 1, filter: "all" });
    expect(titles(state)[0]).toBe("Todo 100");
  });

  test("load marks the state hydrated", () => {
    const state = reducer(initialState, { type: "load", todos: [] });
    expect(state.hydrated).toBe(true);
  });
});

function memoryStorage(initial?: string): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>(initial ? [[STORAGE_KEY, initial]] : []);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("persistence", () => {
  test("save and load round-trip through the storage key", () => {
    const store = memoryStorage();
    const todos = run(adds(2)).todos;
    save(todos, store);
    expect(JSON.parse(store.data.get(STORAGE_KEY) ?? "")).toEqual(todos);
    expect(load(store)).toEqual(todos);
  });

  test("load ignores missing, corrupt and malformed data", () => {
    expect(load(memoryStorage())).toEqual([]);
    expect(load(memoryStorage("{not json"))).toEqual([]);
    expect(load(memoryStorage('{"id":1}'))).toEqual([]);
    expect(
      load(memoryStorage('[{"id":"a","title":"ok","done":false,"createdAt":1},{"id":2}]')),
    ).toEqual([{ id: "a", title: "ok", done: false, createdAt: 1 }]);
  });

  test("no storage means an empty list and a no-op save", () => {
    expect(load(null)).toEqual([]);
    expect(() => save([], null)).not.toThrow();
  });

  test("uses the global localStorage by default", () => {
    localStorage.clear();
    save(run(adds(1)).todos);
    expect(load().map((t) => t.title)).toEqual(["Todo 1"]);
    localStorage.clear();
  });
});

test("newId returns distinct ids", () => {
  expect(newId(1)).not.toBe(newId(1));
});
