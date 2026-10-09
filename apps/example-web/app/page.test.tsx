import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import Page from "./page";

afterEach(() => localStorage.clear());

test("home page renders the shared todo app", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { name: "Todos" })).toBeDefined();
  fireEvent.change(screen.getByTestId("todo-input"), { target: { value: "From the page" } });
  fireEvent.click(screen.getByTestId("todo-add"));
  expect(screen.getByTestId("todo-title").textContent).toBe("From the page");
});
