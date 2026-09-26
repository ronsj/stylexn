import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Page from "./page";

test("home page renders the StyleXN heading", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { name: "StyleXN" })).toBeDefined();
});
