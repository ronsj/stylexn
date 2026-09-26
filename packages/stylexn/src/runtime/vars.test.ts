import { beforeEach, describe, expect, test } from "vitest";
import {
  createTheme,
  defineConsts,
  defineVars,
  lookupVar,
  resetVarsForTesting,
  scopeWith,
} from "./vars.ts";

beforeEach(() => resetVarsForTesting());

describe("defineVars / createTheme", () => {
  test("returns refs with unique names and registers defaults", () => {
    const a = defineVars({ color: "red" });
    const b = defineVars({ color: "blue" });
    expect(a.color.$$stylexnVar).not.toBe(b.color.$$stylexnVar);
    expect(lookupVar(a.color.$$stylexnVar, {}, [])).toBe("red");
    expect(lookupVar(b.color.$$stylexnVar, {}, [])).toBe("blue");
  });

  test("themes override only known keys", () => {
    const vars = defineVars({ color: "red", size: 1 });
    const theme = createTheme(vars, { color: "green", bogus: 3 } as never);
    expect(theme.$$stylexnTheme).toEqual({ [vars.color.$$stylexnVar]: "green" });
  });

  test("lookup order: element themes, then scope, then defaults", () => {
    const vars = defineVars({ color: "red" });
    const name = vars.color.$$stylexnVar;
    const scope = scopeWith({}, [createTheme(vars, { color: "green" })]);
    expect(lookupVar(name, scope, [])).toBe("green");
    expect(lookupVar(name, scope, [createTheme(vars, { color: "blue" })])).toBe("blue");
    expect(lookupVar(name, {}, [])).toBe("red");
    expect(lookupVar("unknown", {}, [])).toBeUndefined();
  });

  test("defineConsts is the identity", () => {
    const c = { gutter: 8 };
    expect(defineConsts(c)).toBe(c);
  });
});
