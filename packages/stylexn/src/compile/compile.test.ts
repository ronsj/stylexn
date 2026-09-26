import { describe, expect, test } from "vitest";
import { compileRule } from "./compile.ts";
import { makeSentinel } from "../sentinel.ts";

describe("compileRule", () => {
  test("static declarations", () => {
    const { rule, findings, diagnostics } = compileRule({
      padding: "8px 16px",
      color: "red",
      lineHeight: 1.2,
    });
    expect(rule).toEqual({
      $$stylexn: 1,
      static: {
        paddingTop: 8,
        paddingRight: 16,
        paddingBottom: 8,
        paddingLeft: 16,
        color: "red",
        lineHeight: "1.2",
      },
      conditional: [],
      props: {},
      conditionalProps: [],
      depth: { paddingTop: 1, paddingRight: 1, paddingBottom: 1, paddingLeft: 1 },
      usesVars: false,
    });
    expect(findings).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  test("conditional declarations flatten into condition chains", () => {
    const { rule } = compileRule({
      marginTop: {
        default: "4px",
        ":hover": "8px",
        "@media (min-width: 800px)": { default: "12px", ":hover": "16px" },
      },
    });
    expect(rule.static).toEqual({ marginTop: 4 });
    expect(rule.conditional).toEqual([
      { key: "marginTop", when: [":hover"], value: 8 },
      { key: "marginTop", when: ["@media (min-width: 800px)"], value: 12 },
      { key: "marginTop", when: ["@media (min-width: 800px)", ":hover"], value: 16 },
    ]);
  });

  test("props and conditional props", () => {
    const { rule } = compileRule({
      color: { default: "black", "::placeholder": "gray" },
      lineClamp: { default: 2, ":hover": 4 },
    });
    expect(rule.static).toEqual({ color: "black" });
    expect(rule.props).toEqual({ placeholderTextColor: "gray", numberOfLines: 2 });
    expect(rule.conditionalProps).toEqual([{ key: "numberOfLines", when: [":hover"], value: 4 }]);
  });

  test("web-only declarations are stripped silently, unsupported ones with a finding", () => {
    const { rule, findings } = compileRule({
      willChange: "transform",
      float: "left",
      color: "red",
    });
    expect(rule.static).toEqual({ color: "red" });
    expect(findings.map((f) => f.status)).toEqual(["web-only", "unsupported"]);
  });

  test("strict keeps unsupported declarations for the caller to report", () => {
    const { rule } = compileRule({ float: "left" }, { strict: true });
    expect(rule.static).toEqual({ float: "left" });
  });

  test("only the offending branch is stripped", () => {
    const { rule } = compileRule({
      color: { default: "red", ":first-child": "blue", ":hover": "green" },
    });
    expect(rule.static).toEqual({ color: "red" });
    expect(rule.conditional).toEqual([{ key: "color", when: [":hover"], value: "green" }]);
  });

  test("a stripped default leaves only the conditional entries", () => {
    const { rule } = compileRule({ width: { default: "fit-content", ":hover": "50%" } });
    // partial values are findings but are not stripped: they reach the runtime as-is
    expect(rule.static).toEqual({ width: "fit-content" });
    const { rule: r2 } = compileRule({ paddingTop: { default: "1ch", ":hover": "2px" } });
    expect(r2.static).toEqual({});
    expect(r2.conditional).toEqual([{ key: "paddingTop", when: [":hover"], value: 2 }]);
  });

  test("sentinels pass through and mark usesVars", () => {
    const s = makeSentinel(0);
    const { rule, findings } = compileRule({ margin: s, color: { default: "red", ":hover": s } });
    expect(rule.static).toMatchObject({ marginTop: s, marginLeft: s, color: "red" });
    expect(rule.conditional).toEqual([{ key: "color", when: [":hover"], value: s }]);
    expect(rule.usesVars).toBe(true);
    expect(findings).toEqual([]);
  });

  test("var() strings mark usesVars", () => {
    expect(compileRule({ color: "var(--x)" }).rule.usesVars).toBe(true);
    expect(compileRule({ color: "red" }).rule.usesVars).toBe(false);
  });

  test("malformed shorthands surface as diagnostics", () => {
    const { diagnostics, findings } = compileRule({ margin: "1px 2px 3px 4px 5px" });
    expect(diagnostics).toHaveLength(1);
    // the property is kept as written and then reported by the checker too
    expect(findings.map((f) => f.kind)).toEqual([]);
  });
});
