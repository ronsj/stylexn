import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Hello } from "./Hello";

test("renders the greeting with compiled StyleX classes", () => {
  render(<Hello name="Ada" />);
  const el = screen.getByText("Hello from @stylexn/shared, Ada!");
  expect(el.tagName).toBe("P");
  // Compiled StyleX emits hashed atomic class names, never inline styles.
  expect(el.className).toMatch(/\bx[a-z0-9]+\b/);
  expect(el.getAttribute("style")).toBeNull();
});
