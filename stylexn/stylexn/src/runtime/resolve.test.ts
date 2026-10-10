import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { compileRule } from "../compile/compile.ts";
import type { CompiledRule } from "../compile/compile.ts";
import type { Declarations } from "../expand/types.ts";
import { analyzeNeeds, flattenArgs, resolve } from "./resolve.ts";
import type { Env } from "./types.ts";
import { createTheme, defineVars, resetVarsForTesting, scopeWith } from "./vars.ts";
import { defaultMarker, defineMarker, when } from "./markers.ts";

const rule = (decls: Declarations) => compileRule(decls).rule;

const env = (overrides: Partial<Env> = {}): Env => ({
  window: { width: 390, height: 844, scale: 3, fontScale: 1 },
  colorScheme: "light",
  reducedMotion: false,
  contrast: "no-preference",
  reducedTransparency: false,
  invertedColors: false,
  pointer: "coarse",
  interaction: {},
  ancestors: null,
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

  test("form states: checked, placeholder-shown, read-only and read-write", () => {
    const r = rule({
      opacity: { default: 1, ":checked": 0.9 },
      color: { default: "black", ":placeholder-shown": "gray" },
      borderBottomColor: { default: "blue", ":read-only": "silver" },
      backgroundColor: { default: "white", ":read-write": "ivory" },
    });
    const at = (interaction: object) => resolve([r], env({ interaction })).style;
    expect(at({ checked: true }).opacity).toBe(0.9);
    expect(at({ checked: false }).opacity).toBe(1);
    expect(at({ placeholderShown: true }).color).toBe("gray");
    expect(at({}).color).toBe("black");
    // Read-write unless read-only or disabled; read-only is the negation.
    expect(at({})).toMatchObject({ borderBottomColor: "blue", backgroundColor: "ivory" });
    expect(at({ readOnly: true })).toMatchObject({
      borderBottomColor: "silver",
      backgroundColor: "white",
    });
    expect(at({ disabled: true })).toMatchObject({
      borderBottomColor: "silver",
      backgroundColor: "white",
    });
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
    // The multiplier cascades as such; a length does not.
    expect(resolve([rule({ lineHeight: 1.5 })], env({ fontSize: 20 })).inherit).toEqual({
      lineHeight: "1.5",
    });
    expect(resolve([rule({ lineHeight: "24px" })], env()).inherit).toBeUndefined();
    // Percentages on fontSize are relative to the inherited font size, and
    // em on other keys to the element's resulting font size.
    expect(
      resolve([rule({ fontSize: "120%", paddingTop: "1em" })], env({ fontSize: 20 })).style,
    ).toEqual({ fontSize: 24, paddingTop: 24 });
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

  test("absolute units in variable values fold to numbers like rule values", () => {
    const vars = defineVars({ gap: "8px", pt: "1.5pt", inch: "1in", half: "50%" });
    const r = rule({
      paddingTop: vars.gap,
      paddingBottom: vars.pt,
      marginTop: vars.inch,
      width: vars.half,
      height: "var(--nope, 3px)",
    });
    expect(resolve([r], env()).style).toEqual({
      paddingTop: 8,
      paddingBottom: 2,
      marginTop: 96,
      width: "50%",
      height: 3,
    });
    const theme = createTheme(vars, { gap: "12px" });
    expect(resolve([theme, r], env()).style.paddingTop).toBe(12);
    const named = rule({ paddingTop: `${vars.gap}` });
    expect(resolve([named], env()).style.paddingTop).toBe(8);
  });

  test("conditional variable values fold absolute units in every branch", () => {
    const vars = defineVars({ pad: { default: "8px", "@media (min-width: 800px)": "12px" } });
    const r = rule({ paddingTop: vars.pad });
    expect(resolve([r], env()).style.paddingTop).toBe(8);
    const wide = env({ window: { width: 1024, height: 768, scale: 2, fontScale: 1 } });
    expect(resolve([r], wide).style.paddingTop).toBe(12);
  });

  test("lineHeight from a variable: a bare number stays a multiplier, px is a length", () => {
    const vars = defineVars({ ratio: "1.5", fixed: "24px" });
    const ratio = resolve([rule({ lineHeight: vars.ratio })], env({ fontSize: 20 }));
    expect(ratio.style.lineHeight).toBe(30);
    expect(ratio.inherit).toEqual({ lineHeight: "1.5" });
    const fixed = resolve([rule({ lineHeight: vars.fixed })], env({ fontSize: 20 }));
    expect(fixed.style.lineHeight).toBe(24);
    expect(fixed.inherit).toBeUndefined();
  });

  test("a box value from a variable folds both sides", () => {
    // No authoring syntax yields a box held in a variable today, so the
    // compiled rules are built by hand to reach the runtime path.
    const vars = defineVars({ offset: { width: "2px", height: "4px" }, x: "1pt", y: "3px" });
    const held: CompiledRule = {
      ...rule({}),
      static: { textShadowOffset: vars.offset },
      usesVars: true,
    };
    expect(resolve([held], env()).style.textShadowOffset).toEqual({ width: 2, height: 4 });
    const sides: CompiledRule = {
      ...rule({}),
      static: { textShadowOffset: { width: vars.x, height: vars.y } },
      usesVars: true,
    };
    expect(resolve([sides], env()).style.textShadowOffset).toEqual({ width: 1.333, height: 3 });
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

  test("transition and animation keys leave the style and become motion specs", () => {
    const r = rule({ transition: "opacity 150ms ease-in", opacity: 1 });
    const resolved = resolve([r], env());
    expect(resolved.style).toEqual({ opacity: 1 });
    expect(resolved.transition?.keys.get("opacity")).toEqual({
      duration: 150,
      delay: 0,
      easing: { type: "bezier", x1: 0.42, y1: 0, x2: 1, y2: 1 },
    });
    expect(resolved.animations).toBeUndefined();
    const a = resolve([rule({ animation: "spin 1s linear infinite" })], env());
    expect(a.animations?.[0]).toMatchObject({ name: "spin", duration: 1000, iterations: Infinity });
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("analyzeNeeds", () => {
  test("reports only what the rules use", () => {
    expect(analyzeNeeds([rule({ color: "red" })])).toEqual({
      interaction: false,
      dimensions: false,
      colorScheme: false,
      reducedMotion: false,
      contrast: false,
      reducedTransparency: false,
      invertedColors: false,
      vars: false,
      ancestors: false,
      motion: false,
      constant: true,
    });
    expect(analyzeNeeds([rule({ color: { ":hover": "red" } })]).interaction).toBe(true);
    expect(analyzeNeeds([rule({ transitionDuration: "1s" })])).toMatchObject({
      motion: true,
      reducedMotion: true,
    });
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

  test("accessibility media features set only their own flag", () => {
    const flags = (decls: Declarations) => {
      const n = analyzeNeeds([rule(decls)]);
      return {
        reducedMotion: n.reducedMotion,
        contrast: n.contrast,
        reducedTransparency: n.reducedTransparency,
        invertedColors: n.invertedColors,
        dimensions: n.dimensions,
        colorScheme: n.colorScheme,
      };
    };
    const none = {
      reducedMotion: false,
      contrast: false,
      reducedTransparency: false,
      invertedColors: false,
      dimensions: false,
      colorScheme: false,
    };
    expect(flags({ color: { "@media (prefers-contrast: more)": "x" } })).toEqual({
      ...none,
      contrast: true,
    });
    expect(flags({ color: { "@media (prefers-reduced-transparency: reduce)": "x" } })).toEqual({
      ...none,
      reducedTransparency: true,
    });
    expect(flags({ color: { "@media (inverted-colors: inverted)": "x" } })).toEqual({
      ...none,
      invertedColors: true,
    });
    expect(flags({ color: { "@media (prefers-reduced-motion: reduce)": "x" } })).toEqual({
      ...none,
      reducedMotion: true,
    });
    // Across several rules, flags combine.
    const combined = analyzeNeeds([
      rule({ color: { "@media (prefers-contrast)": "x" } }),
      rule({ opacity: { "@media (inverted-colors)": 0.5 } }),
    ]);
    expect(combined).toMatchObject({
      contrast: true,
      invertedColors: true,
      reducedTransparency: false,
      reducedMotion: false,
    });
    // Variables do not subscribe to accessibility settings.
    const vars = defineVars({ a: 1 });
    expect(analyzeNeeds([rule({ marginTop: vars.a })])).toMatchObject({
      contrast: false,
      reducedTransparency: false,
      invertedColors: false,
    });
  });

  test("constant: nothing depends on the environment", () => {
    const constant = (decls: Declarations) => analyzeNeeds([rule(decls)]).constant;
    expect(constant({ color: "red", padding: 8, transform: "scale(1)" })).toBe(true);
    expect(constant({ color: { ":hover": "red" } })).toBe(false);
    expect(constant({ transitionDuration: "1s" })).toBe(false);
    expect(constant({ paddingTop: "1rem" })).toBe(false);
    expect(constant({ paddingTop: "0.5em" })).toBe(false);
    expect(constant({ width: "50vw" })).toBe(false);
    expect(constant({ width: "calc(1rem + 8px)" })).toBe(false);
    expect(constant({ lineHeight: 1.5 })).toBe(false);
    expect(constant({ lineHeight: "24px" })).toBe(true);
    expect(constant({ fontSize: "120%" })).toBe(false);
    expect(constant({ marginTop: defineVars({ a: 1 }).a })).toBe(false);
    // Several rules are constant only when each one is.
    const a = rule({ color: "red" });
    expect(analyzeNeeds([a, rule({ padding: 8 })]).constant).toBe(true);
    expect(analyzeNeeds([a, rule({ padding: "1rem" })]).constant).toBe(false);
  });

  test("constant rule lists resolve to one cached object; the rest resolve fresh", () => {
    const a = rule({ color: "red" });
    const b = rule({ padding: 8 });
    const e = env();
    expect(resolve([a, b], e)).toBe(resolve([a, b], e));
    expect(resolve([a, b], e)).not.toBe(resolve([b, a], e));
    expect(resolve([a], e)).not.toBe(resolve([a, b], e));
    const dynamic = rule({ paddingTop: "1rem" });
    expect(resolve([a, dynamic], e)).not.toBe(resolve([a, dynamic], e));
    expect(resolve([a, dynamic], e).style).toEqual({ color: "red", paddingTop: 16 });
  });

  test("flattenArgs separates rules from themes", () => {
    const vars = defineVars({ a: 1 });
    const theme = createTheme(vars, { a: 2 });
    const r = rule({ color: "red" });
    expect(flattenArgs([r, [theme, [r]], null])).toEqual({
      rules: [r, r],
      themes: [theme],
      markers: [],
    });
  });

  test("flattenArgs collects marker ids once each, in order", () => {
    const r = rule({ color: "red" });
    const card = defineMarker("card");
    expect(flattenArgs([card, r, [defaultMarker(), card]]).markers).toEqual([
      "card",
      "default-marker",
    ]);
  });
});

const ancestors = (entries: Record<string, Env["interaction"][]>): Env["ancestors"] =>
  new Map(Object.entries(entries));

describe("ancestor conditions (when.ancestor)", () => {
  const card = defineMarker("card");
  const row = defineMarker("row");

  test("hold when the marked ancestor is in the state; false without one", () => {
    const r = rule({
      color: { default: "black", [when.ancestor(":active", card)]: "red" },
      opacity: { default: 1, [when.ancestor(":hover")]: 0.5 },
    });
    expect(resolve([r], env()).style).toEqual({ color: "black", opacity: 1 });
    expect(resolve([r], env({ ancestors: ancestors({}) })).style.color).toBe("black");
    expect(resolve([r], env({ ancestors: ancestors({ card: [{}] }) })).style.color).toBe("black");
    expect(
      resolve([r], env({ ancestors: ancestors({ card: [{ active: true }] }) })).style.color,
    ).toBe("red");
    // The element's own state does not count, and other markers do not either.
    expect(resolve([r], env({ interaction: { active: true } })).style.color).toBe("black");
    expect(
      resolve([r], env({ ancestors: ancestors({ row: [{ active: true }] }) })).style.color,
    ).toBe("black");
    // when.ancestor without a marker reads the default marker.
    expect(
      resolve([r], env({ ancestors: ancestors({ "default-marker": [{ hover: true }] }) })).style
        .opacity,
    ).toBe(0.5);
  });

  test("every pseudo-class the runtime evaluates works on an ancestor", () => {
    const r = rule({
      color: {
        default: "black",
        [when.ancestor(":disabled", row)]: "gray",
        [when.ancestor(":checked", row)]: "green",
        [when.ancestor(":focus-visible", row)]: "blue",
      },
      opacity: { default: 1, [when.ancestor(":enabled", row)]: 0.9 },
    });
    const of = (state: Env["interaction"]) =>
      resolve([r], env({ ancestors: ancestors({ row: [state] }) })).style;
    expect(of({ disabled: true })).toEqual({ color: "gray", opacity: 1 });
    expect(of({ checked: true })).toEqual({ color: "green", opacity: 0.9 });
    expect(of({ focus: true })).toEqual({ color: "blue", opacity: 0.9 });
  });

  test("any ancestor with the marker counts, like .marker:hover * on the web", () => {
    const r = rule({ color: { default: "black", [when.ancestor(":active", card)]: "red" } });
    const nested = ancestors({ card: [{}, { active: true }] });
    expect(resolve([r], env({ ancestors: nested })).style.color).toBe("red");
  });

  test("descendant and sibling conditions never hold", () => {
    // The compiler strips (or rejects) them; a rule built by hand reaches the resolver.
    const keys = [
      when.descendant(":hover", card),
      when.siblingBefore(":hover", card),
      when.siblingAfter(":hover", card),
      when.anySibling(":hover", card),
    ];
    expect(rule({ color: { default: "black", [keys[0] as string]: "red" } }).conditional).toEqual(
      [],
    );
    const r: CompiledRule = {
      $$stylexn: 1,
      static: { color: "black" },
      conditional: keys.map((k) => ({ key: "color", when: [k], value: "red" })),
      props: {},
      conditionalProps: [],
      depth: {},
      usesVars: false,
    };
    const all = ancestors({ card: [{ hover: true }] });
    expect(resolve([r], env({ ancestors: all, interaction: { hover: true } })).style.color).toBe(
      "black",
    );
  });

  test("analyzeNeeds: ancestor conditions need ancestors, not the element's own interaction", () => {
    const needs = analyzeNeeds([rule({ color: { [when.ancestor(":hover", card)]: "red" } })]);
    expect(needs).toMatchObject({ ancestors: true, interaction: false, constant: false });
    const other = analyzeNeeds([rule({ color: { [when.descendant(":hover")]: "red" } })]);
    expect(other).toMatchObject({ ancestors: false, interaction: false });
    const both = analyzeNeeds([
      rule({ color: { ":hover": "red" } }),
      rule({ opacity: { [when.ancestor(":active")]: 0.5 } }),
    ]);
    expect(both).toMatchObject({ ancestors: true, interaction: true });
  });
});

describe("runtime math", () => {
  test("deferred calc() with relative units folds against the environment", () => {
    const r = rule({
      width: "calc(50vw - 10px)",
      paddingTop: "calc(1rem + 2px)",
      marginTop: "min(1em, 100px)",
    });
    const { style } = resolve(
      [r],
      env({ window: { width: 400, height: 800, scale: 2, fontScale: 1 } }),
    );
    expect(style).toEqual({ width: 190, paddingTop: 18, marginTop: 14 });
  });

  test("absolute-unit variables inside calc() give the same math", () => {
    const vars = defineVars({ x: "8px" });
    expect(resolve([rule({ paddingTop: `calc(${vars.x} + 2px)` })], env()).style.paddingTop).toBe(
      10,
    );
  });

  test("var() inside math and template-string refs", () => {
    const vars = defineVars({ gap: 8, wide: "20px" });
    const r = rule({
      paddingTop: `calc(${vars.gap} * 2)`,
      marginTop: "calc(var(--missing, 4px) + var(--also-missing, 1px))",
      width: `calc(${vars.wide} + 1px)`,
      height: `${vars.gap}`,
    });
    expect(resolve([r], env()).style).toEqual({
      paddingTop: 16,
      marginTop: 5,
      width: 21,
      height: 8,
    });
    expect(
      resolve([r], env({ vars: scopeWith({}, [createTheme(vars, { gap: 10 })]) })).style.paddingTop,
    ).toBe(20);
  });

  test("math nested in transforms resolves in place; unresolvable math is dropped with a warning", () => {
    const r = rule({
      transform: "translateX(calc(1rem + 2px)) scale(1)",
      width: "calc(var(--nope) * 2)",
    });
    expect(resolve([r], env()).style).toEqual({ transform: "translateX(18px) scale(1)" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/--nope has no value/));
  });

  test("viewport units in static values subscribe to dimensions", () => {
    expect(analyzeNeeds([rule({ width: "50vw" })]).dimensions).toBe(true);
    expect(analyzeNeeds([rule({ width: "calc(50vw - 1px)" })]).dimensions).toBe(true);
    expect(analyzeNeeds([rule({ width: "50%" })]).dimensions).toBe(false);
  });
});
