import { expect, test } from "vitest";
import { buildError, lintProblems, typeErrors } from "./diagnostics";

// The Checking styles page prints these; if a layer stops reporting the
// sample's problems, the page would quietly show less than it claims.

test("TypeScript rejects the unsupported value and condition", () => {
  const errors = typeErrors();
  expect(errors.some((e) => e.includes("is not a supported display value on React Native"))).toBe(
    true,
  );
  expect(errors.some((e) => e.includes(":nth-child(2)"))).toBe(true);
}, 30_000);

test("the lint core reports each problem with its position", () => {
  const problems = lintProblems();
  expect(problems).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^packages\/shared\/src\/Card\.tsx:5:\d+ warning: display: "grid"/),
      expect.stringMatching(/willChange/),
      expect.stringMatching(/error: :nth-child\(2\) on color/),
    ]),
  );
});

test("the strict native build fails on the unsupported styles", () => {
  const error = buildError();
  expect(error).toMatch(
    /StyleXN: unsupported styles in packages\/shared\/src\/Card\.tsx rule "card"/,
  );
  expect(error).toMatch(/cannot add a percentage and a length/);
});
