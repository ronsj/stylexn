import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { STORAGE_KEY } from "./store";
import { TodoApp } from "./TodoApp";

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

const input = () => screen.getByTestId("todo-input") as HTMLInputElement;
const titles = () => screen.queryAllByTestId("todo-title").map((el) => el.textContent);

function add(...todos: string[]) {
  for (const title of todos) {
    fireEvent.change(input(), { target: { value: title } });
    fireEvent.click(screen.getByTestId("todo-add"));
  }
}

const item = (title: string) =>
  screen.getAllByTestId("todo-item").find((el) => el.textContent?.includes(title)) as HTMLElement;

test("renders with compiled StyleX classes and an empty list", () => {
  render(<TodoApp />);
  expect(screen.getByText("Todos").className).toMatch(/\bx[a-z0-9]+\b/);
  expect(screen.getByTestId("todo-empty").textContent).toContain("Nothing to do yet");
  // Empty input: the add button is disabled (:disabled styles), as are both pager buttons.
  expect((screen.getByTestId("todo-add") as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByTestId("page-prev") as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByTestId("page-next") as HTMLButtonElement).disabled).toBe(true);
});

test("adds, toggles and filters todos", () => {
  render(<TodoApp />);
  add("Buy milk", "Walk the dog");
  expect(titles()).toEqual(["Walk the dog", "Buy milk"]);
  expect(input().value).toBe("");
  // Return adds too.
  fireEvent.change(input(), { target: { value: "Call mum" } });
  fireEvent.keyDown(input(), { key: "Enter" });
  expect(titles()).toEqual(["Call mum", "Walk the dog", "Buy milk"]);

  fireEvent.click(within(item("Buy milk")).getByTestId("todo-toggle"));
  expect(screen.getByTestId("todo-summary").textContent).toBe("2 left · 1 done");
  fireEvent.click(screen.getByTestId("filter-done"));
  expect(titles()).toEqual(["Buy milk"]);
  fireEvent.click(screen.getByTestId("filter-active"));
  expect(titles()).toEqual(["Call mum", "Walk the dog"]);
  expect(screen.getByTestId("filter-active").getAttribute("aria-selected")).toBe("true");
});

test("paginates five per page", () => {
  render(<TodoApp />);
  add("1", "2", "3", "4", "5", "6");
  expect(screen.getByTestId("page-label").textContent).toBe("Page 1 of 2");
  expect(titles()).toEqual(["6", "5", "4", "3", "2"]);
  fireEvent.click(screen.getByTestId("page-next"));
  expect(screen.getByTestId("page-label").textContent).toBe("Page 2 of 2");
  expect(titles()).toEqual(["1"]);
  expect((screen.getByTestId("page-next") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByTestId("page-prev"));
  expect(titles()).toEqual(["6", "5", "4", "3", "2"]);
});

test("edits a title; Return saves and empty text cancels", () => {
  render(<TodoApp />);
  add("Old title");
  fireEvent.click(screen.getByTestId("todo-edit"));
  const field = screen.getByTestId("todo-edit-input") as HTMLInputElement;
  expect(field.value).toBe("Old title");
  fireEvent.change(field, { target: { value: "New title" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(titles()).toEqual(["New title"]);

  fireEvent.click(screen.getByTestId("todo-edit"));
  fireEvent.change(screen.getByTestId("todo-edit-input"), { target: { value: "  " } });
  fireEvent.blur(screen.getByTestId("todo-edit-input"));
  expect(titles()).toEqual(["New title"]);
});

test("delete animates out before the todo leaves the list", () => {
  vi.useFakeTimers();
  render(<TodoApp />);
  add("Keep", "Drop");
  fireEvent.click(within(item("Drop")).getByTestId("todo-delete"));
  // Still rendered while the transition runs, with its actions disabled.
  expect(titles()).toEqual(["Drop", "Keep"]);
  expect((within(item("Drop")).getByTestId("todo-delete") as HTMLButtonElement).disabled).toBe(
    true,
  );
  act(() => vi.advanceTimersByTime(250));
  expect(titles()).toEqual(["Keep"]);
});

test("deleting the only todo on the last page moves back a page", () => {
  vi.useFakeTimers();
  render(<TodoApp />);
  add("1", "2", "3", "4", "5", "6");
  fireEvent.click(screen.getByTestId("page-next"));
  fireEvent.click(screen.getByTestId("todo-delete"));
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByTestId("page-label").textContent).toBe("Page 1 of 1");
  expect(titles()).toEqual(["6", "5", "4", "3", "2"]);
});

test("persists to localStorage and loads on mount", () => {
  const { unmount } = render(<TodoApp />);
  add("Remember me");
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  expect(saved).toMatchObject([{ title: "Remember me", done: false }]);
  unmount();
  render(<TodoApp />);
  expect(titles()).toEqual(["Remember me"]);
});

test("a pending delete timer is cleared on unmount", () => {
  vi.useFakeTimers();
  const { unmount } = render(<TodoApp />);
  add("Gone soon");
  fireEvent.click(screen.getByTestId("todo-delete"));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
