import { describe, expect, test } from "vitest";
import {
  isLength,
  isTime,
  looksLikeColor,
  splitComma,
  splitSlash,
  splitSpace,
} from "./tokenize.ts";

describe("splitSpace", () => {
  test("splits on whitespace", () => {
    expect(splitSpace("10px  20px\t30px")).toEqual(["10px", "20px", "30px"]);
  });

  test("keeps function arguments together", () => {
    expect(splitSpace("1px solid rgb(0, 0, 0)")).toEqual(["1px", "solid", "rgb(0, 0, 0)"]);
    expect(splitSpace("calc(100% - 2 * 8px) auto")).toEqual(["calc(100% - 2 * 8px)", "auto"]);
  });

  test("keeps quoted strings together", () => {
    expect(splitSpace(`"Helvetica Neue" sans-serif`)).toEqual([`"Helvetica Neue"`, "sans-serif"]);
    expect(splitSpace(`'a b' 'c'`)).toEqual([`'a b'`, `'c'`]);
  });

  test("handles unbalanced parentheses without hanging", () => {
    expect(splitSpace("rgb(0 0 0")).toEqual(["rgb(0 0 0"]);
    expect(splitSpace(") a b")).toEqual([")", "a", "b"]);
  });

  test("empty and blank input", () => {
    expect(splitSpace("")).toEqual([]);
    expect(splitSpace("   ")).toEqual([]);
  });
});

describe("splitComma", () => {
  test("splits lists but not function arguments", () => {
    expect(splitComma("opacity 1s, transform 2s cubic-bezier(0, 0, 1, 1)")).toEqual([
      "opacity 1s",
      "transform 2s cubic-bezier(0, 0, 1, 1)",
    ]);
  });
});

describe("splitSlash", () => {
  test("splits radius groups", () => {
    expect(splitSlash("10px 20px / 5px")).toEqual(["10px 20px", "5px"]);
    expect(splitSlash("10px")).toEqual(["10px"]);
  });
});

describe("classifiers", () => {
  test("isTime", () => {
    expect(isTime("150ms")).toBe(true);
    expect(isTime(".5s")).toBe(true);
    expect(isTime("150")).toBe(false);
    expect(isTime("ease")).toBe(false);
  });

  test("isLength accepts numbers with or without units", () => {
    expect(isLength("10px")).toBe(true);
    expect(isLength("10")).toBe(true);
    expect(isLength("-1.5rem")).toBe(true);
    expect(isLength("50%")).toBe(true);
    expect(isLength("px")).toBe(false);
    expect(isLength("red")).toBe(false);
  });

  test("looksLikeColor", () => {
    expect(looksLikeColor("#fff")).toBe(true);
    expect(looksLikeColor("rgb(0, 0, 0)")).toBe(true);
    expect(looksLikeColor("oklch(0.7 0.1 200)")).toBe(true);
    expect(looksLikeColor("rebeccapurple")).toBe(true);
    expect(looksLikeColor("10px")).toBe(false);
    expect(looksLikeColor("calc(1px + 2px)")).toBe(false);
  });
});
