import { describe, expect, test } from "vitest";
import { expandDeclarations } from "../expand/expand.ts";
import type { Declarations } from "../expand/types.ts";
import { makeSentinel } from "../sentinel.ts";
import { checkDeclarations, isBlocking } from "./check.ts";

const check = (decls: Declarations, options = {}) =>
  checkDeclarations(expandDeclarations(decls).style, options);

const kinds = (decls: Declarations) =>
  check(decls).map((f) => `${f.kind}:${f.status}:${f.property}`);

describe("properties", () => {
  test("supported, polyfilled and partial-with-ok-values produce nothing", () => {
    expect(check({ color: "red", marginTop: "1rem", display: "flex", width: "50%" })).toEqual([]);
  });

  test("unsupported and web-only properties", () => {
    expect(kinds({ float: "left", willChange: "transform" })).toEqual([
      "property:unsupported:float",
      "property:web-only:willChange",
    ]);
  });

  test("unknown properties are unsupported", () => {
    const [f] = check({ madeUpProp: 1 });
    expect(f).toMatchObject({ kind: "property", status: "unsupported", property: "madeUpProp" });
  });

  test("shorthands are checked after expansion", () => {
    expect(check({ margin: "1px 2px" })).toEqual([]);
    expect(kinds({ padding: "1ch" })).toEqual([
      "unit:unsupported:paddingTop",
      "unit:unsupported:paddingRight",
      "unit:unsupported:paddingBottom",
      "unit:unsupported:paddingLeft",
    ]);
  });

  test("version gating", () => {
    expect(check({ boxShadow: "0 1px 2px red" })).toEqual([]);
    const [f] = check({ boxShadow: "0 1px 2px red" }, { rnVersion: "0.75" });
    expect(f).toMatchObject({ kind: "version", status: "unsupported" });
    expect(f?.message).toMatch(/0\.76/);
  });
});

describe("values", () => {
  test("partial keywords", () => {
    expect(kinds({ display: "grid" })).toEqual(["value:partial:display"]);
    expect(kinds({ position: "sticky" })).toEqual(["value:partial:position"]);
    expect(check({ position: "absolute" })).toEqual([]);
  });

  test("token patterns", () => {
    expect(check({ width: "fit-content" })).toHaveLength(1);
    expect(check({ width: 100 })).toEqual([]);
    expect(check({ width: "auto" })).toEqual([]);
    expect(check({ fontWeight: 600 })).toEqual([]);
    expect(check({ fontWeight: "bolder" })).toHaveLength(1);
    expect(check({ fontFamily: "Inter" })).toEqual([]);
  });

  test("function-name values", () => {
    expect(check({ transform: "rotate(10deg) scale(2)" })).toEqual([]);
    const findings = check({ transform: "translate(1px, 2px)" });
    expect(findings.map((f) => f.kind)).toEqual(["value"]);
    expect(check({ backgroundImage: "linear-gradient(red, blue)" })).toEqual([]);
    expect(kinds({ backgroundImage: "url(x.png)" })).toEqual([
      "value:partial:backgroundImage",
      "function:unsupported:backgroundImage",
    ]);
  });

  test("multi-keyword values check each token", () => {
    expect(check({ textDecorationLine: "underline line-through" })).toEqual([]);
    expect(check({ textDecorationLine: "overline" })).toHaveLength(1);
  });

  test("sentinels and null are skipped", () => {
    expect(check({ display: makeSentinel(0), width: null })).toEqual([]);
  });
});

describe("units and functions", () => {
  test("units", () => {
    expect(check({ marginTop: "2rem", width: "10vw", height: "1in" })).toEqual([]);
    expect(kinds({ marginTop: "2ch" })).toEqual(["unit:unsupported:marginTop"]);
    expect(kinds({ marginTop: "2furlongs" })).toEqual(["unit:unsupported:marginTop"]);
  });

  test("functions", () => {
    expect(check({ color: "var(--x)", backgroundColor: "oklch(0.5 0.1 200)" })).toEqual([]);
    expect(check({ display: "var(--d)", width: "calc(1px + 2px)" }).map((f) => f.kind)).toEqual([
      "function",
    ]);
    expect(kinds({ width: "calc(100% - 8px)" })).toEqual(["function:partial:width"]);
    expect(kinds({ paddingTop: "env(safe-area-inset-top)" })).toEqual([
      "function:unsupported:paddingTop",
    ]);
  });
});

describe("conditions", () => {
  test("pseudo-classes", () => {
    expect(check({ color: { default: "a", ":hover": "b", ":active": "c" } })).toEqual([]);
    const [f] = check({ color: { default: "a", ":first-child": "b" } });
    expect(f).toMatchObject({
      kind: "condition",
      status: "unsupported",
      conditions: [":first-child"],
    });
  });

  test("::placeholder is only for color", () => {
    expect(check({ color: { "::placeholder": "gray" } })).toEqual([]);
    expect(kinds({ opacity: { "::placeholder": 0.5 } })).toEqual(["condition:unsupported:opacity"]);
  });

  test("at-rules and media features", () => {
    expect(check({ width: { "@media (min-width: 800px)": "50%" } })).toEqual([]);
    expect(check({ color: { "@media (prefers-color-scheme: dark)": "white" } })).toEqual([]);
    expect(kinds({ color: { "@media print": "black" } })).toEqual([]); // no parenthesised feature
    expect(kinds({ color: { "@media (forced-colors: active)": "black" } })).toEqual([
      "media-feature:web-only:color",
    ]);
    expect(kinds({ width: { "@container (min-width: 400px)": "50%" } })).toEqual([
      "condition:unsupported:width",
    ]);
    expect(kinds({ display: { "@supports (display: grid)": "flex" } })).toEqual([
      "condition:web-only:display",
    ]);
  });

  test("nested conditions report the full chain", () => {
    const findings = check({
      width: { "@media (min-width: 800px)": { default: "50%", ":visited": "10%" } },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.conditions).toEqual(["@media (min-width: 800px)", ":visited"]);
  });

  test("leaf findings carry their condition chain", () => {
    const [f] = check({ width: { default: "1px", ":hover": "fit-content" } });
    expect(f?.conditions).toEqual([":hover"]);
  });
});

describe("isBlocking", () => {
  test("only unsupported blocks", () => {
    const findings = check({ float: "left", willChange: "x", display: "grid" });
    expect(findings.map(isBlocking)).toEqual([true, false, false]);
  });
});
