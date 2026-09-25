import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Page from "./page";

test("home page renders the shared Hello component", () => {
  render(<Page />);
  expect(screen.getByText("Hello from @stylexn/shared, web!")).toBeDefined();
});
