import { describe, expect, test } from "vitest";
import { foldedToken, foldMath } from "./fold.ts";

const fold = (token: string) => {
  const r = foldMath(token);
  return r === null ? null : r.ok ? foldedToken(r) : `error: ${r.reason}`;
};

describe("foldMath", () => {
  test("lengths, numbers and percentages fold to one token", () => {
    expect(fold("calc(10px + 5px)")).toBe("15px");
    expect(fold("calc(1in - 2pt)")).toBe("93.333px");
    expect(fold("calc(100% / 3)")).toBe("33.333%");
    expect(fold("calc(2 * 3)")).toBe("6");
    expect(fold("calc((10px + 2px) * 2)")).toBe("24px");
    expect(fold("calc(-4px + 10px)")).toBe("6px");
    expect(fold("min(10px, 4px, 20px)")).toBe("4px");
    expect(fold("max(1, 2)")).toBe("2");
    expect(fold("clamp(10px, calc(2px * 20), 30px)")).toBe("30px");
    expect(fold("CALC(1px+2px)")).toBe("3px");
  });

  test("not a math function", () => {
    expect(fold("10px")).toBeNull();
    expect(fold("rgb(0, 0, 0)")).toBeNull();
  });

  test("things React Native cannot represent are errors", () => {
    expect(fold("calc(100% - 20px)")).toMatch(/cannot add a percentage and a length/);
    expect(fold("calc(1rem + 2px)")).toMatch(/unit "rem" is not static/);
    expect(fold("calc(var(--x) * 2)")).toMatch(/var\(\) is not static/);
    expect(fold("calc(10px * 2px)")).toMatch(/cannot multiply/);
    expect(fold("calc(10px / 0)")).toMatch(/division by zero/);
    expect(fold("min(1px, 2%)")).toMatch(/mixes units/);
    expect(fold("clamp(1px, 2px)")).toMatch(/three values/);
    expect(fold("calc(1px +)")).toMatch(/unexpected/);
  });
});
