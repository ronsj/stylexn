import { expect, test } from "vitest";
import { greeting } from "./greeting";

test("greeting includes the name", () => {
  expect(greeting("Ada")).toBe("Hello from @stylexn/shared, Ada!");
});
