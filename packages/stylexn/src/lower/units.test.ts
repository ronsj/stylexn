import { describe, expect, test } from "vitest";
import { normalizeAngles, parseLength, toNumber } from "./units.ts";

describe("parseLength", () => {
  test("numbers, units, percentages", () => {
    expect(parseLength("10px")).toEqual({ value: 10, unit: "px" });
    expect(parseLength("-1.5REM")).toEqual({ value: -1.5, unit: "rem" });
    expect(parseLength("50%")).toEqual({ value: 50, unit: "%" });
    expect(parseLength("0")).toEqual({ value: 0, unit: "" });
    expect(parseLength(".5em")).toEqual({ value: 0.5, unit: "em" });
  });

  test("rejects non-lengths", () => {
    expect(parseLength("auto")).toBeNull();
    expect(parseLength("calc(1px + 2px)")).toBeNull();
    expect(parseLength("10px 20px")).toBeNull();
    expect(parseLength("")).toBeNull();
  });
});

describe("toNumber", () => {
  test("absolute units convert to dp (1dp = 1px)", () => {
    expect(toNumber("16px")).toBe(16);
    expect(toNumber("12pt")).toBe(16);
    expect(toNumber("1in")).toBe(96);
    expect(toNumber("2.54cm")).toBe(96);
    expect(toNumber("1pc")).toBe(16);
    expect(toNumber("25.4mm")).toBe(96);
  });

  test("bare numbers pass through", () => {
    expect(toNumber("3")).toBe(3);
    expect(toNumber("-0.5")).toBe(-0.5);
  });

  test("percentages, relative units and keywords are left for later", () => {
    expect(toNumber("50%")).toBeNull();
    expect(toNumber("1rem")).toBeNull();
    expect(toNumber("10vw")).toBeNull();
    expect(toNumber("auto")).toBeNull();
  });
});

describe("normalizeAngles", () => {
  test("turn and grad become deg; deg and rad are untouched", () => {
    expect(normalizeAngles("rotate(0.5turn)")).toBe("rotate(180deg)");
    expect(normalizeAngles("rotate(100grad) skewX(10deg)")).toBe("rotate(90deg) skewX(10deg)");
    expect(normalizeAngles("rotate(1rad)")).toBe("rotate(1rad)");
  });
});
