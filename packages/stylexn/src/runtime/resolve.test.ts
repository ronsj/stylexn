import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { compileRule } from "../compile/compile.ts";
import type { Declarations } from "../expand/types.ts";
import { analyzeNeeds, flattenArgs, resolve } from "./resolve.ts";
import type { Env } from "./types.ts";
import { createTheme, defineVars, resetVarsForTesting } from "./vars.ts";

const rule = (decls: Declarations) => compileRule(decls).rule;

const env = (overrides: Partial<Env> = {}): Env => ({
  window: { width: 390, height: 844, scale: 3, fontScale: 1 },
  colorScheme: "light",
  reducedMotion: false,
  pointer: "coarse",
  interaction: {},
  vars: {},
  rootFontSize: 16,
  fontSize: 14,
  platform: "ios",
  ...overrides,
});

beforeEach(() => {
  resetVarsForTesting();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("merge", () => {
  test("later rules win, falsy and arrays are accepted", () => {
    const a = rule({ color: "red", marginTop: 1 });
    const b = rule({ color: "blue" });
    expect(resolve([a, false, [null, b]], env()).style).toEqual({ color: "blue", marginTop: 1 });
  });

  test("property-specificity across rules", () => {
    const longhand = rule({ marginTop: 5 });
    const shorthand = rule({ margin: 10 });
    expect(resolve([longhand, shorthand], env()).style).toEqual({
      marginTop: 5,
      marginRight: 10,
      marginBottom: 10,
      marginLeft: 10,
    });
  });

  test("conditions override the default within a rule when they hold", () => {
    const r = rule({ color: { default: "red", ":hover": "blue", ":active": "green" } });
    expect(resolve([r], env()).style.color).toBe("red");
    expect(resolve([r], env({ interaction: { hover: true } })).style.color).toBe("blue");
    expect(resolve([r], env({ interaction: { hover: true, active: true } })).style.color).toBe(
      "green",
    );
  });

  test("nested media and interaction chains", () => {
    const r = rule({
      width: { default: "100%", "@media (min-width: 800px)": { default: "50%", ":hover": "40%" } },
    });
    expect(resolve([r], env()).style.width).toBe("100%");
    const wide = env({ window: { width: 1000, height: 800, scale: 2, fontScale: 1 } });
    expect(resolve([r], wide).style.width).toBe("50%");
    expect(resolve([r], { ...wide, interaction: { hover: true } }).style.width).toBe("40%");
  });

  test("disabled/enabled and unknown conditions", () => {
    const r = rule({ opacity: { default: 1, ":disabled": 0.5 } });
    expect(resolve([r], env({ interaction: { disabled: true } })).style.opacity).toBe(0.5);
    expect(resolve([r], env()).style.opacity).toBe(1);
  });

  test("props merge and resolve too", () => {
    const r = rule({ lineClamp: { default: 1, ":hover": 3 }, color: { "::placeholder": "gray" } });
    const out = resolve([r], env({ interaction: { hover: true } }));
    expect(out.props).toEqual({ numberOfLines: 3, placeholderTextColor: "gray" });
  });
});

describe("units", () => {
  test("rem, em, viewport units", () => {
    const r = rule({
      marginTop: "1rem",
      paddingTop: "2em",
      width: "50vw",
      height: "10vmin",
      fontSize: "1.5rem",
    });
    expect(resolve([r], env()).style).toEqual({
      fontSize: 24,
      marginTop: 16,
      paddingTop: 48, // em against the element's own resolved fontSize
      width: 195,
      height: 39,
    });
  });

  test("em falls back to the inherited font size", () => {
    expect(resolve([rule({ paddingTop: "1em" })], env({ fontSize: 20 })).style.paddingTop).toBe(20);
    expect(resolve([rule({ lineHeight: 1.5 })], env({ fontSize: 20 })).style.lineHeight).toBe(30);
  });

  test("percentages and keywords pass through", () => {
    expect(resolve([rule({ width: "50%", top: "auto" })], env()).style).toEqual({
      width: "50%",
      top: "auto",
    });
  });
});

describe("variables and themes", () => {
  test("var refs resolve to defaults, themes override per element", () => {
    const vars = defineVars({ accent: "red", space: 8 });
    const r = rule({ color: vars.accent, margin: vars.space });
    expect(resolve([r], env()).style).toMatchObject({ color: "red", marginTop: 8 });
    const theme = createTheme(vars, { accent: "blue" });
    expect(resolve([theme, r], env()).style.color).toBe("blue");
    expect(resolve([r, theme], env()).style.color).toBe("blue"); // position does not matter
  });

  test("provider scope sits between element themes and defaults", () => {
    const vars = defineVars({ accent: "red" });
    const r = rule({ color: vars.accent });
    const scoped = env({ vars: { [vars.accent.$$stylexnVar]: "green" } });
    expect(resolve([r], scoped).style.color).toBe("green");
    expect(resolve([createTheme(vars, { accent: "blue" }), r], scoped).style.color).toBe("blue");
  });

  test("variables with media defaults resolve against the env", () => {
    const vars = defineVars({
      bg: { default: "white", "@media (prefers-color-scheme: dark)": "black" },
      pad: { default: "1rem", "@media (min-width: 800px)": "2rem" },
    });
    const r = rule({ backgroundColor: vars.bg, paddingTop: vars.pad });
    expect(resolve([r], env()).style).toEqual({ backgroundColor: "white", paddingTop: 16 });
    expect(resolve([r], env({ colorScheme: "dark" })).style.backgroundColor).toBe("black");
  });

  test("var() strings look up by name with a fallback", () => {
    const r = rule({ color: "var(--missing, red)" });
    expect(resolve([r], env()).style.color).toBe("red");
    expect(resolve([rule({ color: "var(--missing)" })], env()).style).toEqual({});
  });

  test("an unknown var ref is dropped with a warning", () => {
    const r = rule({ color: { $$stylexnVar: "nope" } as never });
    expect(resolve([r], env()).style).toEqual({});
    expect(console.warn).toHaveBeenCalledOnce();
  });
});

describe("finalization and not-yet-supported keys", () => {
  test("border side styles collapse after the merge", () => {
    const a = rule({ border: "1px solid red" });
    const b = rule({ borderLeftStyle: "dashed" });
    const { style } = resolve([a, b], env());
    expect(style.borderStyle).toBe("solid");
    expect(console.warn).not.toHaveBeenCalled(); // the runtime does not spam per render
  });

  test("text shadow offsets become an object", () => {
    const { style } = resolve([rule({ textShadow: "1px 2px 3px black" })], env());
    expect(style.textShadowOffset).toEqual({ width: 1, height: 2 });
  });

  test("transition keys are dropped with a one-time warning", () => {
    const r = rule({ transition: "opacity 150ms", opacity: 1 });
    expect(resolve([r], env()).style).toEqual({ opacity: 1 });
    resolve([r], env());
    expect(console.warn).toHaveBeenCalledTimes(4); // one per transition longhand, once
  });
});

describe("analyzeNeeds", () => {
  test("reports only what the rules use", () => {
    expect(analyzeNeeds([rule({ color: "red" })])).toEqual({
      interaction: false,
      dimensions: false,
      colorScheme: false,
      reducedMotion: false,
      vars: false,
    });
    expect(analyzeNeeds([rule({ color: { ":hover": "red" } })]).interaction).toBe(true);
    expect(analyzeNeeds([rule({ width: { "@media (min-width: 1px)": 1 } })]).dimensions).toBe(true);
    expect(
      analyzeNeeds([rule({ width: { "@media (orientation: portrait)": 1 } })]).dimensions,
    ).toBe(true);
    const scheme = analyzeNeeds([rule({ color: { "@media (prefers-color-scheme: dark)": "x" } })]);
    expect(scheme).toMatchObject({ colorScheme: true, dimensions: false });
    const vars = defineVars({ a: 1 });
    expect(analyzeNeeds([rule({ marginTop: vars.a })])).toMatchObject({
      vars: true,
      colorScheme: true,
      dimensions: true,
    });
  });

  test("flattenArgs separates rules from themes", () => {
    const vars = defineVars({ a: 1 });
    const theme = createTheme(vars, { a: 2 });
    const r = rule({ color: "red" });
    expect(flattenArgs([r, [theme, [r]], null])).toEqual({ rules: [r, r], themes: [theme] });
  });
});
