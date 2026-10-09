import { describe, expect, test } from "vitest";
import { compileRule } from "./compile.ts";
import { makeFirstThatWorks as ftw } from "../first-that-works.ts";
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
    // a value outside width's list is stripped (a strict build rejects it)
    expect(rule.static).toEqual({});
    expect(rule.conditional).toEqual([{ key: "width", when: [":hover"], value: "50%" }]);
    expect(compileRule({ width: "fit-content" }, { strict: true }).rule.static).toEqual({
      width: "fit-content",
    }); // strict keeps it for the caller to error on
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

  test("firstThatWorks keeps the first accepted candidate, shorthands included", () => {
    const { rule, findings } = compileRule({
      minHeight: ftw(["100cqh", "100dvh", "100vh"]),
      margin: ftw(["1ch 2px", "4px 8px"]),
      position: { default: "relative", ":hover": ftw(["sticky", "absolute"]) },
    });
    expect(rule.static).toMatchObject({ minHeight: "100dvh", marginTop: 4, marginLeft: 8 });
    expect(rule.conditional).toEqual([{ key: "position", when: [":hover"], value: "absolute" }]);
    expect(findings).toEqual([]);
  });

  test("firstThatWorks with no accepted candidate: one finding, the declaration or branch dropped", () => {
    for (const strict of [false, true]) {
      const { rule, findings } = compileRule(
        { width: ftw(["10ch", "1cqw"]), color: { default: "red", ":hover": ftw(["1ch"]) } },
        { strict },
      );
      expect(rule.static).toEqual({ color: "red" });
      expect(rule.conditional).toEqual([]);
      expect(findings).toEqual([
        {
          kind: "function",
          status: "unsupported",
          property: "width",
          conditions: [],
          value: 'firstThatWorks("10ch", "1cqw")',
          message: 'width: none of firstThatWorks("10ch", "1cqw") is supported on React Native',
        },
        expect.objectContaining({ property: "color", conditions: [":hover"] }),
      ]);
    }
  });

  test("firstThatWorks: runtime values win when reached, trusted properties take the first", () => {
    const s = makeSentinel(0);
    expect(compileRule({ width: ftw(["1ch", s, "4px"]) }).rule.static).toEqual({ width: s });
    const trusted = compileRule({ width: ftw(["1ch", "4px"]) }, { trusted: new Set(["width"]) });
    expect(trusted.rule.static).toEqual({ width: "1ch" });
  });

  test("firstThatWorks: the property-level check still applies to the chosen candidate", () => {
    const { findings } = compileRule({ float: ftw(["left", "right"]) });
    expect(findings).toMatchObject([{ kind: "property", property: "float" }]);
  });

  test("malformed shorthands surface as diagnostics", () => {
    const { diagnostics, findings } = compileRule({ margin: "1px 2px 3px 4px 5px" });
    expect(diagnostics).toHaveLength(1);
    // the property is kept as written and then reported by the checker too
    expect(findings.map((f) => f.kind)).toEqual([]);
  });
});
