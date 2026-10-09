import { describe, expect, test } from "vitest";
import { expandDeclarations } from "../expand/expand.ts";
import { mergeExpanded } from "../expand/merge.ts";
import type { Declarations } from "../expand/types.ts";
import { makeSentinel } from "../sentinel.ts";
import { finalizeStyle, lowerDeclarations } from "./lower.ts";

const lower = (decls: Declarations) => lowerDeclarations(expandDeclarations(decls));
const inset = (v: string | number) => lower({ scrollPadding: v }).props.contentInset;
const fv = (v: string) => lower({ fontFeatureSettings: v }).style.fontVariant;

describe("lowerDeclarations: units and numbers", () => {
  test("absolute units become numbers, everything else stays", () => {
    const { style } = lower({
      marginTop: "10px",
      paddingTop: "1in",
      width: "50%",
      height: "10vh",
      fontSize: "1rem",
      top: "auto",
      zIndex: 3,
    });
    expect(style).toEqual({
      marginTop: 10,
      paddingTop: 96,
      width: "50%",
      height: "10vh",
      fontSize: "1rem",
      top: "auto",
      zIndex: 3,
    });
  });

  test("expanded shorthand values are lowered too and keep their depth", () => {
    const { style, depth } = lower({ margin: "8px 16px" });
    expect(style).toEqual({ marginTop: 8, marginRight: 16, marginBottom: 8, marginLeft: 16 });
    expect(depth.marginTop).toBe(1);
  });

  test("border width keywords", () => {
    expect(lower({ border: "solid red" }).style.borderTopWidth).toBe(3); // medium
    expect(lower({ borderTopWidth: "thin" }).style.borderTopWidth).toBe(1);
  });

  test("opacity strings become numbers", () => {
    expect(lower({ opacity: "0.5" }).style.opacity).toBe(0.5);
  });
});

describe("lowerDeclarations: renames and props", () => {
  test("logical properties map to React Native keys", () => {
    const { style } = lower({
      borderInlineStartWidth: 2,
      inlineSize: "100px",
      backgroundImage: "linear-gradient(red, blue)",
      fontVariantNumeric: "tabular-nums",
    });
    expect(style).toEqual({
      borderStartWidth: 2,
      width: 100,
      experimental_backgroundImage: "linear-gradient(red, blue)",
      fontVariant: "tabular-nums",
    });
  });

  test("style-to-prop mappings", () => {
    const { style, props } = lower({
      caretColor: "red",
      textOverflow: "ellipsis",
      lineClamp: 2,
      color: { default: "black", "::placeholder": "gray" },
    });
    expect(props).toEqual({
      cursorColor: "red",
      ellipsizeMode: "tail",
      numberOfLines: 2,
      placeholderTextColor: "gray",
    });
    expect(style).toEqual({ color: { default: "black" } });
  });

  test("::placeholder on anything but color is a diagnostic", () => {
    const { diagnostics } = lower({ opacity: { default: 1, "::placeholder": 0.5 } });
    expect(diagnostics[0]?.property).toBe("opacity[::placeholder]");
  });
});

describe("lowerDeclarations: scroll container props", () => {
  test("scrollSnapType becomes pagingEnabled", () => {
    expect(lower({ scrollSnapType: "x mandatory" }).props).toEqual({ pagingEnabled: true });
    expect(lower({ scrollSnapType: "y" }).props).toEqual({ pagingEnabled: true });
    expect(lower({ scrollSnapType: "both proximity" }).props).toEqual({ pagingEnabled: true });
    expect(lower({ scrollSnapType: "none" }).props).toEqual({ pagingEnabled: false });
    const bad = lower({ scrollSnapType: "mandatory" });
    expect(bad.props).toEqual({});
    expect(bad.diagnostics.map((d) => d.property)).toEqual(["scrollSnapType"]);
    expect(lower({ scrollSnapType: "x mandatory always" }).diagnostics).toHaveLength(1);
  });

  test("scrollSnapAlign becomes snapToAlignment; none unsets it", () => {
    expect(lower({ scrollSnapAlign: "center" }).props).toEqual({ snapToAlignment: "center" });
    expect(lower({ scrollSnapAlign: "none" }).props).toEqual({ snapToAlignment: null });
    expect(
      lower({ scrollSnapAlign: { default: "start", "@media (min-width: 600px)": "none" } }).props,
    ).toEqual({ snapToAlignment: { default: "start", "@media (min-width: 600px)": null } });
    const bad = lower({ scrollSnapAlign: "start end" });
    expect(bad.props).toEqual({});
    expect(bad.diagnostics[0]?.message).toMatch(/scrollSnapAlign "start end"/);
  });

  test("scrollSnapStop becomes disableIntervalMomentum", () => {
    expect(lower({ scrollSnapStop: "always" }).props).toEqual({ disableIntervalMomentum: true });
    expect(lower({ scrollSnapStop: "normal" }).props).toEqual({ disableIntervalMomentum: false });
    expect(lower({ scrollSnapStop: "sometimes" }).diagnostics).toHaveLength(1);
  });

  test("overscrollBehavior becomes bounces and overScrollMode", () => {
    expect(lower({ overscrollBehavior: "auto" }).props).toEqual({
      bounces: true,
      overScrollMode: "auto",
    });
    for (const value of ["contain", "none"]) {
      expect(lower({ overscrollBehavior: value }).props).toEqual({
        bounces: false,
        overScrollMode: "never",
      });
    }
    expect(lower({ overscrollBehavior: null }).props).toEqual({
      bounces: null,
      overScrollMode: null,
    });
    const bad = lower({ overscrollBehavior: "contain auto" });
    expect(bad.props).toEqual({});
    expect(bad.diagnostics).toHaveLength(1);
  });

  test("scrollPadding becomes contentInset in CSS side order", () => {
    expect(inset(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
    expect(inset("8px 16px")).toEqual({ top: 8, right: 16, bottom: 8, left: 16 });
    expect(inset("1px 2px 3px")).toEqual({ top: 1, right: 2, bottom: 3, left: 2 });
    expect(inset("1px 2px 3px 4px")).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
    expect(inset("calc(4px * 2)")).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  test("scrollPadding needs one to four absolute lengths", () => {
    for (const value of ["10%", "1em", "auto", "1px 2px 3px 4px 5px", "8px auto"]) {
      const { props, diagnostics } = lower({ scrollPadding: value });
      expect(props, value).toEqual({});
      expect(diagnostics[0]?.message, value).toMatch(/scrollPadding/);
    }
  });

  test("value-reading properties need static values", () => {
    const { props, diagnostics } = lower({ scrollSnapType: makeSentinel(0) });
    expect(props).toEqual({});
    expect(diagnostics[0]?.message).toMatch(/needs a static value/);
  });
});

describe("lowerDeclarations: text", () => {
  test("lineHeight", () => {
    expect(lower({ lineHeight: 1.5 }).style.lineHeight).toBe("1.5"); // a multiplier
    expect(lower({ lineHeight: "1.5" }).style.lineHeight).toBe("1.5");
    expect(lower({ lineHeight: "24px" }).style.lineHeight).toBe(24);
    expect(lower({ lineHeight: "normal" }).style).toEqual({});
  });

  test("fontFamily keeps the first family, unquoted", () => {
    expect(lower({ fontFamily: `"Helvetica Neue", Arial, sans-serif` }).style.fontFamily).toBe(
      "Helvetica Neue",
    );
  });

  test("fontVariant becomes an array", () => {
    expect(lower({ fontVariant: "small-caps tabular-nums" }).style.fontVariant).toEqual([
      "small-caps",
      "tabular-nums",
    ]);
    expect(lower({ fontVariant: "normal" }).style.fontVariant).toEqual([]);
  });

  test("hyphens becomes android_hyphenationFrequency", () => {
    expect(lower({ hyphens: "auto" }).props).toEqual({ android_hyphenationFrequency: "full" });
    expect(lower({ hyphens: "manual" }).props).toEqual({ android_hyphenationFrequency: "normal" });
    expect(lower({ hyphens: "none" }).props).toEqual({ android_hyphenationFrequency: "none" });
    const bad = lower({ hyphens: "always" });
    expect(bad.props).toEqual({});
    expect(bad.diagnostics).toHaveLength(1);
  });

  test("fontFeatureSettings becomes fontVariant entries", () => {
    expect(fv(`"tnum"`)).toEqual(["tabular-nums"]);
    expect(fv(`"tnum" 1, 'smcp' on`)).toEqual(["tabular-nums", "small-caps"]);
    expect(fv(`"pnum", "lnum", "onum"`)).toEqual([
      "proportional-nums",
      "lining-nums",
      "oldstyle-nums",
    ]);
    expect(fv(`"liga" 0, "dlig", "hlig" off, "calt" 0`)).toEqual([
      "no-common-ligatures",
      "discretionary-ligatures",
      "no-historical-ligatures",
      "no-contextual",
    ]);
    expect(fv(`"ss01", "ss12", "ss20"`)).toEqual([
      "stylistic-one",
      "stylistic-twelve",
      "stylistic-twenty",
    ]);
    // Off is already the default for features without a no-* form.
    expect(fv(`"tnum" 0`)).toEqual([]);
    expect(fv("normal")).toEqual([]);
  });

  test("unknown feature tags are diagnostics; the known ones stay", () => {
    const mixed = lower({ fontFeatureSettings: `"zero", "tnum", "ss21"` });
    expect(mixed.style.fontVariant).toEqual(["tabular-nums"]);
    expect(mixed.diagnostics.map((d) => d.message)).toEqual([
      `fontFeatureSettings "zero" has no React Native fontVariant counterpart`,
      `fontFeatureSettings "ss21" has no React Native fontVariant counterpart`,
    ]);
    const none = lower({ fontFeatureSettings: `"kern", tnum` });
    expect(none.style).toEqual({});
    expect(none.diagnostics).toHaveLength(2);
  });

  test("fontVariant sources in one rule are merged", () => {
    expect(
      lower({
        fontVariantNumeric: "tabular-nums",
        fontVariantCaps: "small-caps",
        fontFeatureSettings: `"liga" 0, "tnum"`,
      }).style.fontVariant,
    ).toEqual(["tabular-nums", "small-caps", "no-common-ligatures"]);
    // A conditional source cannot be merged statically: the later one wins.
    expect(
      lower({
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: { default: `"smcp"`, ":hover": "normal" },
      }).style.fontVariant,
    ).toEqual({ default: ["small-caps"], ":hover": [] });
  });

  test("relative font weights and overline are diagnostics", () => {
    const { style, diagnostics } = lower({
      fontWeight: "bolder",
      textDecorationLine: "underline overline",
    });
    expect(style).toEqual({ textDecorationLine: "underline" });
    expect(diagnostics.map((d) => d.property)).toEqual(["fontWeight", "textDecorationLine"]);
  });

  test("letterSpacing normal is 0, aspectRatio loses spaces, transform angles normalise", () => {
    const { style } = lower({
      letterSpacing: "normal",
      aspectRatio: "16 / 9",
      transform: "rotate(0.25turn)",
    });
    expect(style).toEqual({ letterSpacing: 0, aspectRatio: "16/9", transform: "rotate(90deg)" });
  });
});

describe("lowerDeclarations: colors and polyfills", () => {
  test("currentcolor is dropped with a diagnostic", () => {
    const { style, diagnostics } = lower({ border: "1px solid" });
    expect(style.borderTopColor).toBeUndefined();
    expect(diagnostics.some((d) => /currentcolor/.test(d.message))).toBe(true);
  });

  test("visibility hidden becomes opacity 0 and pointerEvents none", () => {
    expect(lower({ visibility: "hidden" }).style).toEqual({ opacity: 0, pointerEvents: "none" });
    expect(lower({ visibility: "visible" }).style).toEqual({});
  });

  test("conditional values are lowered per branch", () => {
    const { style } = lower({
      visibility: { default: "visible", ":hover": "hidden" },
      marginTop: { default: "4px", "@media (min-width: 800px)": "1rem" },
    });
    expect(style).toEqual({
      opacity: { ":hover": 0 },
      pointerEvents: { ":hover": "none" },
      marginTop: { default: 4, "@media (min-width: 800px)": "1rem" },
    });
  });

  test("null passes through so the merge can unset", () => {
    expect(lower({ marginTop: null }).style).toEqual({ marginTop: null });
    expect(lower({ caretColor: null }).props).toEqual({ cursorColor: null });
  });

  test("unsupported side styles fall back to solid with a diagnostic", () => {
    const { style, diagnostics } = lower({ borderTopStyle: "double" });
    expect(style.borderTopStyle).toBe("solid");
    expect(diagnostics).toHaveLength(1);
  });
});

describe("lowerDeclarations: folding and color conversion", () => {
  test("static math folds into numbers and percentages", () => {
    const { style, diagnostics } = lower({
      width: "calc(100% / 4)",
      marginTop: "calc(1in - 2px)",
      padding: "calc(4px * 2) min(8px, 2pt)",
      lineHeight: "calc(10px + 2px)",
      flexGrow: "calc(1 + 1)",
    });
    expect(style).toEqual({
      width: "25%",
      marginTop: 94,
      paddingTop: 8,
      paddingRight: 2.667,
      paddingBottom: 8,
      paddingLeft: 2.667,
      lineHeight: 12,
      flexGrow: 2,
    });
    expect(diagnostics).toEqual([]);
  });

  test("math that cannot be static is dropped with a diagnostic", () => {
    const { style, diagnostics } = lower({ width: "calc(100% - 20px)", height: 10 });
    expect(style).toEqual({ height: 10 });
    expect(diagnostics[0]).toMatchObject({ property: "width" });
    expect(diagnostics[0]?.message).toMatch(/cannot add a percentage and a length/);
  });

  test("CIE/OK colors and color-mix() become rgb()", () => {
    const { style } = lower({
      color: "oklch(62.8% 0.2577 29.23)",
      backgroundColor: { default: "color-mix(in srgb, #f00 50%, #00f)", ":hover": "lab(100 0 0)" },
      borderColor: "color(srgb 0 0 1 / 0.5)",
    });
    expect(style.color).toBe("rgb(255, 0, 0)");
    expect(style.backgroundColor).toEqual({
      default: "rgb(128, 0, 128)",
      ":hover": "rgb(255, 255, 255)",
    });
    expect(style.borderTopColor).toBe("rgba(0, 0, 255, 0.5)");
  });

  test("math and colors fold inside other functions; deferred math is kept", () => {
    expect(
      lower({ transform: "translateX(calc(10px + 5px)) rotate(calc(0.25turn * 2))" }).style
        .transform,
    ).toBe("translateX(15px) rotate(180deg)");
    expect(lower({ transform: "translateX(calc(1rem + 2px))" }).style.transform).toBe(
      "translateX(calc(1rem + 2px))",
    );
    expect(lower({ width: "calc(50vw - 10px)" }).style.width).toBe("calc(50vw - 10px)");
    expect(lower({ backgroundImage: "linear-gradient(oklab(1 0 0), red)" }).style).toEqual({
      experimental_backgroundImage: "linear-gradient(rgb(255, 255, 255), red)",
    });
  });
});

describe("lowerDeclarations: env()", () => {
  test("safe-area insets become stylexn-env variables, fallback kept", () => {
    const { style, diagnostics } = lower({
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom, 12px)",
      marginTop: "calc(8px + env(safe-area-inset-top))",
    });
    expect(diagnostics).toEqual([]);
    expect(style).toEqual({
      paddingTop: "var(--stylexn-env.safeAreaInsetTop)",
      paddingBottom: "var(--stylexn-env.safeAreaInsetBottom, 12px)",
      marginTop: "calc(8px + var(--stylexn-env.safeAreaInsetTop))",
    });
  });

  test("conditional branches and shorthands are rewritten too", () => {
    const { style } = lower({
      padding: "env(safe-area-inset-top) 0 0 env(safe-area-inset-left)",
      marginTop: { default: 0, "@media (orientation: landscape)": "env(safe-area-inset-top)" },
    });
    expect(style.paddingTop).toBe("var(--stylexn-env.safeAreaInsetTop)");
    expect(style.paddingLeft).toBe("var(--stylexn-env.safeAreaInsetLeft)");
    expect(style.marginTop).toEqual({
      default: 0,
      "@media (orientation: landscape)": "var(--stylexn-env.safeAreaInsetTop)",
    });
  });

  test("other environment variables are dropped with a diagnostic", () => {
    const { style, diagnostics } = lower({ paddingBottom: "env(keyboard-inset-height, 0px)" });
    expect(style).toEqual({});
    expect(diagnostics[0]?.message).toMatch(/env\(keyboard-inset-height\) does not exist/);
  });
});

describe("lowerDeclarations: lh", () => {
  test("an absolute lineHeight makes numbers", () => {
    expect(lower({ lineHeight: "20px", paddingTop: "1lh" }).style.paddingTop).toBe(20);
    expect(lower({ lineHeight: "18pt", paddingTop: "0.5lh" }).style.paddingTop).toBe(12);
    expect(lower({ lineHeight: "20px", marginTop: "calc(1lh + 4px)" }).style.marginTop).toBe(24);
  });

  test("a numeric lineHeight is a unitless multiplier, as in StyleX", () => {
    expect(lower({ lineHeight: 20, paddingTop: "1lh" }).style.paddingTop).toBe("20em");
  });

  test("a unitless, percentage or em lineHeight makes em", () => {
    expect(lower({ lineHeight: 1.5, marginTop: "2lh" }).style.marginTop).toBe("3em");
    expect(lower({ lineHeight: "150%", marginTop: "1lh" }).style.marginTop).toBe("1.5em");
    expect(lower({ lineHeight: "1.25em", marginTop: "2lh" }).style.marginTop).toBe("2.5em");
    expect(lower({ lineHeight: 1.5, marginTop: "calc(1lh + 4px)" }).style.marginTop).toBe(
      "calc(1.5em + 4px)",
    );
  });

  test("conditional branches are rewritten", () => {
    const { style } = lower({
      lineHeight: "20px",
      marginTop: { default: "1lh", ":hover": "2lh" },
    });
    expect(style.marginTop).toEqual({ default: 20, ":hover": 40 });
  });

  test("without a static lineHeight the declaration is dropped with a diagnostic", () => {
    for (const lineHeight of [
      undefined,
      { default: 20, ":hover": 24 },
      "var(--lh)",
      "1rem",
      "normal",
    ]) {
      const { style, diagnostics } = lower({
        ...(lineHeight === undefined ? {} : { lineHeight }),
        marginTop: "1lh",
      } as Declarations);
      expect(style.marginTop).toBeUndefined();
      expect(diagnostics.map((d) => d.message)).toEqual([
        "`lh` needs a static lineHeight in the same rule",
      ]);
    }
  });

  test("lh in lineHeight itself is a diagnostic", () => {
    const { diagnostics } = lower({ lineHeight: "2lh" });
    expect(diagnostics[0]?.message).toMatch(/parent's line height/);
  });

  test("the font shorthand's line height counts", () => {
    const { style } = lower({ font: "16px/1.5 Arial", marginTop: "1lh" });
    expect(style.marginTop).toBe("1.5em");
  });
});

describe("finalizeStyle", () => {
  test("collapses equal side styles into borderStyle", () => {
    const { style, diagnostics } = finalizeStyle({
      borderTopStyle: "dashed",
      borderRightStyle: "dashed",
      borderBottomStyle: "dashed",
      borderLeftStyle: "dashed",
      borderTopWidth: 1,
    });
    expect(style).toEqual({ borderStyle: "dashed", borderTopWidth: 1 });
    expect(diagnostics).toEqual([]);
  });

  test("conflicting side styles use the first and warn", () => {
    const { style, diagnostics } = finalizeStyle({
      borderTopStyle: "solid",
      borderLeftStyle: "dashed",
    });
    expect(style).toEqual({ borderStyle: "solid" });
    expect(diagnostics[0]?.message).toMatch(/one borderStyle/);
  });

  test("none zeroes that side's width instead of setting a style", () => {
    const { style } = finalizeStyle({
      borderTopStyle: "none",
      borderBottomStyle: "solid",
      borderTopWidth: 2,
      borderBottomWidth: 2,
      borderInlineStartStyle: "hidden",
    });
    expect(style).toEqual({
      borderStyle: "solid",
      borderTopWidth: 0,
      borderBottomWidth: 2,
      borderStartWidth: 0,
    });
  });

  test("outline none and text shadow offsets", () => {
    const { style } = finalizeStyle({
      outlineStyle: "none",
      outlineWidth: 2,
      textShadowOffsetX: 1,
      textShadowOffsetY: 2,
      textShadowRadius: 3,
    });
    expect(style).toEqual({
      outlineWidth: 0,
      textShadowOffset: { width: 1, height: 2 },
      textShadowRadius: 3,
    });
  });

  test("does not touch unrelated keys", () => {
    const input = { color: "red", fontVariant: ["small-caps"] };
    expect(finalizeStyle(input).style).toEqual(input);
  });
});

describe("end to end: expand -> merge -> lower -> finalize", () => {
  test("a realistic card style", () => {
    const base = expandDeclarations({
      padding: "12px 16px",
      border: "1px solid #ccc",
      borderRadius: 8,
      textShadow: "0 1px 2px rgba(0,0,0,0.2)",
    });
    const override = expandDeclarations({ borderLeftWidth: 4, borderBottomStyle: "none" });
    const lowered = lowerDeclarations(mergeExpanded([base, override]));
    const leaves = Object.fromEntries(
      Object.entries(lowered.style).map(([k, v]) => [k, v as string | number]),
    );
    const { style } = finalizeStyle(leaves);
    expect(style).toEqual({
      paddingTop: 12,
      paddingRight: 16,
      paddingBottom: 12,
      paddingLeft: 16,
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 0,
      borderLeftWidth: 4,
      borderStyle: "solid",
      borderTopColor: "#ccc",
      borderRightColor: "#ccc",
      borderBottomColor: "#ccc",
      borderLeftColor: "#ccc",
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8,
      borderBottomLeftRadius: 8,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      textShadowColor: "rgba(0,0,0,0.2)",
    });
  });
});
