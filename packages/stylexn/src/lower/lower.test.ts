import { describe, expect, test } from "vitest";
import { expandDeclarations } from "../expand/expand.ts";
import { mergeExpanded } from "../expand/merge.ts";
import type { Declarations } from "../expand/types.ts";
import { finalizeStyle, lowerDeclarations } from "./lower.ts";

const lower = (decls: Declarations) => lowerDeclarations(expandDeclarations(decls));

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

describe("lowerDeclarations: text", () => {
  test("lineHeight", () => {
    expect(lower({ lineHeight: 1.5 }).style.lineHeight).toBe("1.5em");
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
