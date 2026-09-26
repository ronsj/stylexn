import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Hello } from "./Hello";

test("renders the greeting with compiled StyleX classes", () => {
  render(<Hello name="Ada" />);
  const el = screen.getByText("Hello from @stylexn/shared, Ada!");
  expect(el.tagName).toBe("SPAN");
  // Compiled StyleX emits hashed atomic class names, never inline styles.
  expect(el.className).toMatch(/\bx[a-z0-9]+\b/);
  expect(el.getAttribute("style")).toBeNull();
  // The View element carries React Native's layout defaults as classes too.
  expect(el.parentElement?.tagName).toBe("DIV");
  expect(el.parentElement?.className).toMatch(/\bx[a-z0-9]+\b/);
});

test("the pressable counts presses", () => {
  render(<Hello name="Ada" />);
  const button = screen.getByTestId("hello-button");
  expect(button.tagName).toBe("BUTTON");
  expect(button.textContent).toBe("Pressed 0 times");
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button.textContent).toBe("Pressed 2 times");
});
