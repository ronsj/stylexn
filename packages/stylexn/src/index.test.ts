import { expect, test } from "vitest";
import { PACKAGE_NAME } from "./index";

// Toolchain smoke test; replace with compat-table tests once they exist.
test("package entry loads", () => {
  expect(PACKAGE_NAME).toBe("stylexn");
});
