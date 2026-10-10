import { describe, expect, test } from "vitest";
import { expandDeclarations } from "../expand/expand.ts";
import type { Declarations } from "../expand/types.ts";
import { makeSentinel } from "../sentinel.ts";
import { lookupProperty } from "../compat/index.ts";
import { acceptsValue, checkDeclarations, isBlocking } from "./check.ts";

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

  test("multi-word values the table lists whole are accepted as written", () => {
    expect(check({ scrollSnapType: "x mandatory" })).toEqual([]);
    expect(check({ scrollSnapType: "inline  proximity" })).toEqual([]);
    expect(kinds({ scrollSnapType: "mandatory" })).toEqual(["value:partial:scrollSnapType"]);
    expect(acceptsValue(lookupProperty("scrollSnapType"), "both mandatory")).toBe(true);
    expect(acceptsValue(lookupProperty("scrollSnapType"), "x always")).toBe(false);
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
    // Static math folds at compile time; only what cannot fold is reported.
    expect(
      check({ display: "var(--d)", width: "calc(1px + 2px)", height: "min(1px, 2px)" }),
    ).toEqual([]);
    expect(kinds({ width: "calc(100% - 8px)" })).toEqual(["function:partial:width"]);
    expect(check({ width: "calc(1rem + 2px)", height: "calc(var(--h) * 2)" })).toEqual([]); // runtime
    expect(check({ width: "calc(1ch + 2px)" })[0]?.message).toMatch(/"ch" is not supported/);
    // Nested inside other functions too.
    expect(check({ transform: "translateX(calc(1px + 1px))" })).toEqual([]);
    expect(kinds({ transform: "translateX(calc(100% - 1px))" })).toEqual([
      "function:partial:transform",
    ]);
    // Colors likewise: convertible ones pass, the rest is reported.
    expect(check({ color: "color-mix(in srgb, #f00, #00f)" })).toEqual([]);
    expect(kinds({ color: "color-mix(in srgb, nope, blue)" })).toEqual(["function:partial:color"]);
  });

  test("env(): safe-area insets pass, other environment variables are unsupported", () => {
    expect(
      check({
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom, 12px)",
        marginTop: "calc(8px + env(safe-area-inset-top))",
        padding: "env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)",
      }),
    ).toEqual([]);
    expect(kinds({ paddingBottom: "env(keyboard-inset-height, 0px)" })).toEqual([
      "function:unsupported:paddingBottom",
    ]);
    const [f] = check({ top: "calc(env(titlebar-area-y) + 4px)" });
    expect(f?.message).toMatch(/env\(titlebar-area-y\) — Safe-area insets/);
    expect(check({ top: "calc(env(titlebar-area-y) + 4px)" })).toHaveLength(1);
  });

  test("lh resolves against the rule's static lineHeight", () => {
    expect(check({ lineHeight: 20, paddingTop: "1lh", marginTop: "calc(1lh + 4px)" })).toEqual([]);
    expect(check({ lineHeight: "150%", marginTop: "0.5lh" })).toEqual([]);
    expect(kinds({ marginTop: "1lh" })).toEqual(["unit:unsupported:marginTop"]);
    expect(check({ marginTop: "1lh" })[0]?.message).toMatch(/needs a static lineHeight/);
    expect(
      kinds({
        lineHeight: { default: 20, ":hover": 24 },
        marginTop: { default: "1lh", ":hover": 0 },
      }),
    ).toEqual(["unit:unsupported:marginTop"]);
    expect(kinds({ lineHeight: "2lh" })).toEqual(["unit:unsupported:lineHeight"]);
    expect(kinds({ lineHeight: 20, marginTop: "1rlh" })).toEqual(["unit:unsupported:marginTop"]);
  });

  test("font shorthand: checked as its longhands", () => {
    expect(check({ font: 'italic small-caps bold 16px/1.5 "Helvetica Neue", Arial' })).toEqual([]);
    expect(kinds({ font: "condensed 16px Arial" })).toEqual(["property:unsupported:fontStretch"]);
    expect(kinds({ font: "bolder 16px Arial" })).toEqual(["value:partial:fontWeight"]);
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

  test("when.ancestor: judged by its pseudo-class; markers are opaque", () => {
    const marker = makeSentinel(0);
    expect(
      check({
        color: {
          default: "a",
          [`:where-ancestor(:hover, ${marker})`]: "b",
          ":where-ancestor(:active, default-marker)": "c",
          [`:where-ancestor(:checked, ${marker})`]: { default: "d", ":hover": "e" },
        },
      }),
    ).toEqual([]);
    const [f] = check({ color: { [`:where-ancestor(:first-child, ${marker})`]: "b" } });
    expect(f).toMatchObject({
      kind: "condition",
      status: "unsupported",
      conditions: [`:where-ancestor(:first-child, ${marker})`],
    });
    expect(f?.message).toMatch(/^when\.ancestor\(:first-child\) on color — /);
    expect(kinds({ color: { ":where-ancestor(:visited, m1)": "b" } })).toEqual([
      "condition:web-only:color",
    ]);
    expect(kinds({ color: { ":where-ancestor([data-open], m1)": "b" } })).toEqual([
      "condition:unsupported:color",
    ]);
  });

  test("descendant and sibling conditions are unsupported", () => {
    for (const kind of ["descendant", "sibling-before", "sibling-after", "any-sibling"]) {
      const [f, ...rest] = check({ color: { [`:where-${kind}(:hover, m1)`]: "b" } });
      expect(rest).toEqual([]);
      expect(f).toMatchObject({ kind: "condition", status: "unsupported", property: "color" });
      expect(f?.message).toMatch(/descendant and sibling conditions need selectors/);
    }
    expect(kinds({ color: { ":where-nonsense(:hover, m1)": "b" } })).toEqual([
      "condition:unsupported:color",
    ]);
  });

  test("::placeholder is only for color", () => {
    expect(check({ color: { "::placeholder": "gray" } })).toEqual([]);
    expect(kinds({ opacity: { "::placeholder": 0.5 } })).toEqual(["condition:unsupported:opacity"]);
  });

  test("at-rules and media features", () => {
    expect(check({ width: { "@media (min-width: 800px)": "50%" } })).toEqual([]);
    expect(check({ color: { "@media (prefers-color-scheme: dark)": "white" } })).toEqual([]);
    for (const query of [
      "(prefers-contrast: more)",
      "(prefers-reduced-transparency: reduce)",
      "(inverted-colors: inverted)",
    ]) {
      expect(check({ color: { [`@media ${query}`]: "white" } }), query).toEqual([]);
    }
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
  test("unsupported and out-of-list values block; web-only and folding limits do not", () => {
    const findings = check({
      float: "left",
      willChange: "x",
      display: "grid",
      width: "calc(100% - 8px)",
    });
    expect(findings.map((f) => `${f.kind}:${isBlocking(f)}`)).toEqual([
      "property:true",
      "property:false",
      "value:true",
      "function:false",
    ]);
  });
});
