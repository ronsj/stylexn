import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  propsOf,
  resetTestEnv,
  setColorScheme,
  startedAnimations,
  styleOf,
} from "stylexn/testing/react-native";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";

// The same component tree Metro renders on a device, through StyleXN's
// runtime and the mocked React Native primitives (Animated is recorded, not run).

beforeEach(() => {
  resetTestEnv();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

const input = () => screen.getByTestId("todo-input");
const titles = () => screen.queryAllByTestId("todo-title").map((el) => el.textContent);
const item = (title: string) =>
  screen.getAllByTestId("todo-item").find((el) => el.textContent?.includes(title)) as HTMLElement;

function add(...todos: string[]) {
  for (const title of todos) {
    fireEvent.change(input(), { target: { value: title } });
    fireEvent.click(screen.getByTestId("todo-add"));
  }
}

type Interpolation = { $$interpolation: { outputRange: unknown[] } };
/** A transitioned value's target (the end of its interpolation), or the plain value. */
const target = (value: unknown) =>
  typeof value === "object" && value !== null && "$$interpolation" in value
    ? (value as Interpolation).$$interpolation.outputRange.at(-1)
    : value;
const label = () => within(screen.getByTestId("todo-delete")).getByText("Delete");
const caret = () => propsOf(input()).cursorColor;
const timings = () =>
  startedAnimations.flatMap((a) => (a.kind === "timing" && a.config ? [a.config] : []));

test("renders the shared todo app with native styles and safe-area insets", () => {
  render(<App />);
  const heading = screen.getByText("Todos");
  expect(heading.tagName).toBe("RN-TEXT");
  // calc(1.5rem + env(safe-area-inset-top)) with the stubbed 47pt notch inset.
  const screenView = heading.closest("rn-view")?.parentElement?.parentElement
    ?.parentElement as HTMLElement;
  expect(styleOf(screenView)).toMatchObject({
    flexGrow: 1,
    paddingTop: 24 + 47,
    paddingBottom: 24 + 34,
    paddingLeft: 16,
    backgroundColor: "#f4f1f9",
  });
  // fontFeatureSettings and the text prop mappings.
  expect(styleOf(screen.getByTestId("page-label")).fontVariant).toEqual(["tabular-nums"]);
  add("A todo with a long title");
  expect(propsOf(screen.getByTestId("todo-title"))).toMatchObject({
    numberOfLines: 2,
    ellipsizeMode: "tail",
  });
  // rem tokens resolve to points; the web-only declarations are gone.
  expect(styleOf(screen.getByTestId("todo-item"))).toMatchObject({
    height: 56,
    rowGap: 8,
    borderTopLeftRadius: 10,
    elevation: 1,
  });
  expect(styleOf(screen.getByTestId("todo-item"))).not.toHaveProperty("willChange");
});

test("a new todo animates in, a deleted one collapses before it is removed", () => {
  vi.useFakeTimers();
  render(<App />);
  add("Keep", "Drop");
  // Only the todo just added runs the enter keyframes.
  expect(styleOf(item("Drop")).opacity).toMatchObject({
    $$interpolation: { outputRange: [0, 1] },
  });
  expect(styleOf(item("Keep")).opacity).toBe(1);

  startedAnimations.length = 0;
  fireEvent.click(within(item("Keep")).getByTestId("todo-delete"));
  const row = styleOf(item("Keep"));
  expect(target(row.opacity)).toBe(0);
  expect(target(row.height)).toBe(0);
  expect(target(row.marginBottom)).toBe(0);
  // Height is a layout key, so the row's transitions share the JS driver.
  expect(timings()).toContainEqual(
    expect.objectContaining({ duration: 250, useNativeDriver: false }),
  );
  act(() => vi.advanceTimersByTime(250));
  expect(titles()).toEqual(["Drop"]);
});

test("changing page remounts the list with a slide-in animation", () => {
  render(<App />);
  add("1", "2", "3", "4", "5", "6");
  startedAnimations.length = 0;
  fireEvent.click(screen.getByTestId("page-next"));
  expect(screen.getByTestId("page-label").textContent).toBe("Page 2 of 2");
  expect(titles()).toEqual(["1"]);
  expect(styleOf(screen.getByTestId("todo-list")).transform).toEqual([
    {
      translateX: expect.objectContaining({
        $$interpolation: { inputRange: [0, 1], outputRange: [24, 0] },
      }),
    },
  ]);
  expect(timings()).toContainEqual(
    expect.objectContaining({ duration: 280, useNativeDriver: true }),
  );
  expect(propsOf(screen.getByTestId("page-next"))).toMatchObject({ disabled: true });
});

test("form states: placeholder-shown, disabled and checked", () => {
  render(<App />);
  // Empty: the quiet border, and the add button is disabled.
  expect(styleOf(input()).borderTopColor).toBe("#e4dff0");
  expect(propsOf(screen.getByTestId("todo-add"))).toMatchObject({ disabled: true });
  fireEvent.change(input(), { target: { value: "Typed" } });
  expect(target(styleOf(input()).borderTopColor)).toMatch(/#6a3db8|rgb\(106, 61, 184\)/);
  fireEvent.click(screen.getByTestId("todo-add"));
  const toggle = screen.getByTestId("todo-toggle");
  expect(styleOf(toggle).opacity).toBe(1);
  fireEvent.change(toggle, { target: { checked: true } });
  expect(target(styleOf(screen.getByTestId("todo-toggle")).opacity)).toBe(0.65);
  expect(styleOf(screen.getByTestId("todo-title"))).toMatchObject({
    textDecorationLine: "line-through",
  });
});

test("the row's actions follow its hover through the marker", () => {
  render(<App />);
  add("Hover me");
  expect(styleOf(label()).color).toBe("#6f6880");
  fireEvent.pointerEnter(screen.getByTestId("todo-item"));
  expect(target(styleOf(label()).color)).toMatch(/#c2410c|rgb\(194, 65, 12\)/);
});

test("follows the colour scheme and the teal theme through defineVars", () => {
  render(<App />);
  expect(caret()).toBe("#6a3db8");
  act(() => setColorScheme("dark"));
  expect(caret()).toBe("#a987e6");
  fireEvent.change(screen.getByTestId("theme-toggle"), { target: { checked: true } });
  expect(caret()).toBe("#2dd4bf");
});

test("persists todos to localStorage and loads them on the next launch", () => {
  const { unmount } = render(<App />);
  add("Remember me");
  expect(JSON.parse(localStorage.getItem("stylexn-todos") ?? "[]")).toMatchObject([
    { title: "Remember me", done: false },
  ]);
  unmount();
  render(<App />);
  expect(titles()).toEqual(["Remember me"]);
});
