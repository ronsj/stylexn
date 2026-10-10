import { describe, expect, test } from "vitest";
import { propertyEntries as properties } from "../compat/table.ts";
import { expandDeclarations, longhandsOf, shorthandDepth } from "./expand.ts";
import { expanders } from "./shorthands.ts";

describe("expanders and the compat table agree", () => {
  test("every property with expandsTo has an expander", () => {
    for (const [key, entry] of Object.entries(properties)) {
      if (entry.expandsTo) expect(key in expanders, `${key} needs an expander`).toBe(true);
    }
  });

  test("every expander is a table shorthand", () => {
    for (const key of Object.keys(expanders)) {
      const entry = properties[key];
      expect(entry?.expandsTo, `${key} needs expandsTo in the table`).toBeDefined();
    }
  });
});

const expand = (decls: Parameters<typeof expandDeclarations>[0]) => expandDeclarations(decls);

describe("shorthandDepth", () => {
  test("longhands are 0, shorthands count levels", () => {
    expect(shorthandDepth("marginTop")).toBe(0);
    expect(shorthandDepth("margin")).toBe(1);
    expect(shorthandDepth("borderWidth")).toBe(1);
    expect(shorthandDepth("border")).toBe(2);
    expect(shorthandDepth("borderInline")).toBe(2);
    expect(shorthandDepth("notAProperty")).toBe(0);
  });

  test("longhandsOf flattens the hierarchy", () => {
    expect(longhandsOf("border")).toEqual([
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "borderTopStyle",
      "borderRightStyle",
      "borderBottomStyle",
      "borderLeftStyle",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ]);
    expect(longhandsOf("marginTop")).toEqual(["marginTop"]);
  });
});

describe("box shorthands", () => {
  test("single number applies to all sides and stays a number", () => {
    expect(expand({ margin: 10 }).style).toEqual({
      marginTop: 10,
      marginRight: 10,
      marginBottom: 10,
      marginLeft: 10,
    });
  });

  test("CSS 1-4 value order", () => {
    expect(expand({ padding: "1px 2px" }).style).toEqual({
      paddingTop: "1px",
      paddingRight: "2px",
      paddingBottom: "1px",
      paddingLeft: "2px",
    });
    expect(expand({ padding: "1px 2px 3px" }).style).toEqual({
      paddingTop: "1px",
      paddingRight: "2px",
      paddingBottom: "3px",
      paddingLeft: "2px",
    });
    expect(expand({ inset: "1px 2px 3px 4px" }).style).toEqual({
      top: "1px",
      right: "2px",
      bottom: "3px",
      left: "4px",
    });
  });

  test("records the shorthand depth for every produced longhand", () => {
    expect(expand({ margin: 10 }).depth).toEqual({
      marginTop: 1,
      marginRight: 1,
      marginBottom: 1,
      marginLeft: 1,
    });
    expect(expand({ marginTop: 10 }).depth).toEqual({});
  });

  test("too many values is a diagnostic and the property is kept", () => {
    const result = expand({ margin: "1px 2px 3px 4px 5px" });
    expect(result.style).toEqual({ margin: "1px 2px 3px 4px 5px" });
    expect(result.diagnostics).toEqual([
      {
        property: "margin",
        value: "1px 2px 3px 4px 5px",
        message: "expected 1 to 4 values, got 5",
      },
    ]);
  });

  test("pairs, corners and gap", () => {
    expect(expand({ marginInline: "auto" }).style).toEqual({
      marginInlineStart: "auto",
      marginInlineEnd: "auto",
    });
    expect(expand({ borderRadius: "1px 2px 3px" }).style).toEqual({
      borderTopLeftRadius: "1px",
      borderTopRightRadius: "2px",
      borderBottomRightRadius: "3px",
      borderBottomLeftRadius: "2px",
    });
    expect(expand({ gap: "4px 8px" }).style).toEqual({ rowGap: "4px", columnGap: "8px" });
  });

  test("elliptical radii are rejected", () => {
    const result = expand({ borderRadius: "10px / 5px" });
    expect(result.style.borderRadius).toBe("10px / 5px");
    expect(result.diagnostics[0]?.message).toMatch(/elliptical/);
  });
});

describe("border-like shorthands", () => {
  test("border expands two levels down with CSS initial values for omitted parts", () => {
    const { style, depth } = expand({ border: "1px solid red" });
    expect(style).toEqual({
      borderTopWidth: "1px",
      borderRightWidth: "1px",
      borderBottomWidth: "1px",
      borderLeftWidth: "1px",
      borderTopStyle: "solid",
      borderRightStyle: "solid",
      borderBottomStyle: "solid",
      borderLeftStyle: "solid",
      borderTopColor: "red",
      borderRightColor: "red",
      borderBottomColor: "red",
      borderLeftColor: "red",
    });
    expect(depth.borderTopWidth).toBe(2);
    expect(expand({ border: "solid" }).style.borderTopWidth).toBe("medium");
    expect(expand({ border: "2px" }).style.borderTopColor).toBe("currentcolor");
  });

  test("tokens in any order, colors via functions", () => {
    expect(expand({ borderTop: "rgb(0, 0, 0) dashed 2px" }).style).toEqual({
      borderTopWidth: "2px",
      borderTopStyle: "dashed",
      borderTopColor: "rgb(0, 0, 0)",
    });
  });

  test("outline and logical borders", () => {
    expect(expand({ outline: "2px auto blue" }).style).toEqual({
      outlineWidth: "2px",
      outlineStyle: "auto",
      outlineColor: "blue",
    });
    expect(expand({ borderInlineStart: "1px solid" }).style).toEqual({
      borderInlineStartWidth: "1px",
      borderInlineStartStyle: "solid",
      borderInlineStartColor: "currentcolor",
    });
    expect(expand({ borderInline: "1px" }).style).toMatchObject({
      borderStartWidth: "1px",
      borderEndWidth: "1px",
      borderStartColor: "currentcolor",
    });
  });

  test("duplicate slots and junk are diagnostics", () => {
    expect(expand({ border: "1px 2px" }).diagnostics[0]?.message).toMatch(/duplicate/);
    expect(expand({ border: "1px solid ???" }).diagnostics[0]?.message).toMatch(/unrecognised/);
  });
});

describe("flex family", () => {
  test("numeric flex is kept for React Native semantics", () => {
    expect(expand({ flex: 1 }).style).toEqual({ flex: 1 });
    expect(expand({ flex: 1 }).depth).toEqual({});
  });

  test("string flex expands with CSS semantics", () => {
    expect(expand({ flex: "1" }).style).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: "0%" });
    expect(expand({ flex: "2 0 auto" }).style).toEqual({
      flexGrow: 2,
      flexShrink: 0,
      flexBasis: "auto",
    });
    expect(expand({ flex: "none" }).style).toEqual({
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "auto",
    });
    expect(expand({ flex: "30%" }).style).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: "30%" });
  });

  test("flexFlow and placeContent", () => {
    expect(expand({ flexFlow: "wrap column" }).style).toEqual({
      flexDirection: "column",
      flexWrap: "wrap",
    });
    expect(expand({ flexFlow: "row" }).style).toEqual({ flexDirection: "row", flexWrap: "nowrap" });
    expect(expand({ placeContent: "center" }).style).toEqual({
      alignContent: "center",
      justifyContent: "center",
    });
  });
});

describe("text and effects", () => {
  test("textDecoration", () => {
    expect(expand({ textDecoration: "underline line-through red dotted" }).style).toEqual({
      textDecorationLine: "underline line-through",
      textDecorationStyle: "dotted",
      textDecorationColor: "red",
    });
    expect(expand({ textDecoration: "none" }).style.textDecorationLine).toBe("none");
  });

  test("textShadow keeps the first shadow of a list", () => {
    expect(expand({ textShadow: "1px 2px 3px rgba(0,0,0,.5), 0 0 red" }).style).toEqual({
      textShadowOffsetX: "1px",
      textShadowOffsetY: "2px",
      textShadowRadius: "3px",
      textShadowColor: "rgba(0,0,0,.5)",
    });
    expect(expand({ textShadow: "1px 1px" }).style.textShadowColor).toBe("currentcolor");
    expect(expand({ textShadow: "none" }).style.textShadowColor).toBeNull();
  });

  test("transition lists become comma-joined longhands", () => {
    expect(expand({ transition: "opacity 150ms ease-in 50ms, transform 300ms" }).style).toEqual({
      transitionProperty: "opacity, transform",
      transitionDuration: "150ms, 300ms",
      transitionTimingFunction: "ease-in, ease",
      transitionDelay: "50ms, 0s",
    });
    expect(expand({ transition: "all 1s cubic-bezier(0.4, 0, 0.2, 1)" }).style).toMatchObject({
      transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    });
  });

  test("animation", () => {
    expect(expand({ animation: "spin 1s linear infinite" }).style).toEqual({
      animationName: "spin",
      animationDuration: "1s",
      animationTimingFunction: "linear",
      animationDelay: "0s",
      animationIterationCount: "infinite",
      animationDirection: "normal",
      animationFillMode: "none",
      animationPlayState: "running",
    });
    expect(expand({ animation: "fade 200ms 100ms both" }).style).toMatchObject({
      animationDelay: "100ms",
      animationFillMode: "both",
    });
  });

  test("background accepts a single color only", () => {
    expect(expand({ background: "red" }).style).toEqual({ backgroundColor: "red" });
    expect(expand({ background: "none" }).style).toEqual({ backgroundColor: "transparent" });
    const bad = expand({ background: "url(x.png) red" });
    expect(bad.style.background).toBe("url(x.png) red");
    expect(bad.diagnostics).toHaveLength(1);
  });
});

describe("font", () => {
  test("every part, quoted family with spaces kept as written", () => {
    expect(
      expand({ font: 'italic small-caps bold 16px/1.5 "Helvetica Neue", Arial' }).style,
    ).toEqual({
      fontStyle: "italic",
      fontVariantCaps: "small-caps",
      fontWeight: "bold",
      fontSize: "16px",
      lineHeight: "1.5",
      fontFamily: '"Helvetica Neue", Arial',
    });
  });

  test("omitted style, weight and line height reset to normal; no variant or stretch", () => {
    expect(expand({ font: "16px Arial" }).style).toEqual({
      fontStyle: "normal",
      fontWeight: "normal",
      fontSize: "16px",
      lineHeight: "normal",
      fontFamily: "Arial",
    });
  });

  test("numeric weight, rem size and the slash in any spacing", () => {
    const expected = {
      fontStyle: "normal",
      fontWeight: "700",
      fontSize: "1.25rem",
      lineHeight: "2",
      fontFamily: "system-ui",
    };
    expect(expand({ font: "700 1.25rem/2 system-ui" }).style).toEqual(expected);
    expect(expand({ font: "700 1.25rem / 2 system-ui" }).style).toEqual(expected);
    expect(expand({ font: "700 1.25rem /2 system-ui" }).style).toEqual(expected);
    expect(expand({ font: "700 1.25rem/ 2 system-ui" }).style).toEqual(expected);
  });

  test("normal, oblique angles, stretch and unquoted multi-word families", () => {
    expect(
      expand({ font: "normal oblique 10deg condensed 12px Helvetica Neue, sans-serif" }).style,
    ).toEqual({
      fontStyle: "oblique 10deg",
      fontWeight: "normal",
      fontStretch: "condensed",
      fontSize: "12px",
      lineHeight: "normal",
      fontFamily: "Helvetica Neue, sans-serif",
    });
    expect(expand({ font: "large serif" }).style.fontSize).toBe("large");
  });

  test("system fonts, a missing size or family and junk are diagnostics", () => {
    for (const [value, message] of [
      ["menu", /system fonts are not supported/],
      ["16px", /missing font family/],
      ["16px/1.5", /missing font family/],
      ["bold Arial", /unrecognised token "Arial"/],
      ["bold", /missing font size/],
      ["bold bold 16px Arial", /duplicate fontWeight/],
      ["16px/wide Arial", /invalid line height/],
    ] as const) {
      const result = expand({ font: value });
      expect(result.style.font).toBe(value);
      expect(result.diagnostics[0]?.message).toMatch(message);
    }
  });

  test("conditional values expand per branch", () => {
    expect(
      expand({ font: { default: "16px Arial", ":hover": "bold 18px/1.2 Arial" } }).style,
    ).toEqual({
      fontStyle: { default: "normal", ":hover": "normal" },
      fontWeight: { default: "normal", ":hover": "bold" },
      fontSize: { default: "16px", ":hover": "18px" },
      lineHeight: { default: "normal", ":hover": "1.2" },
      fontFamily: { default: "Arial", ":hover": "Arial" },
    });
  });

  test("null unsets every longhand except fontStretch", () => {
    expect(longhandsOf("font")).toEqual([
      "fontStyle",
      "fontVariantCaps",
      "fontWeight",
      "fontSize",
      "lineHeight",
      "fontFamily",
    ]);
  });
});

describe("values", () => {
  test("null unsets every longhand", () => {
    expect(expand({ padding: null }).style).toEqual({
      paddingTop: null,
      paddingRight: null,
      paddingBottom: null,
      paddingLeft: null,
    });
  });

  test("conditional values are expanded per branch and regrouped per longhand", () => {
    expect(expand({ margin: { default: "1px 2px", ":hover": 4 } }).style).toEqual({
      marginTop: { default: "1px", ":hover": 4 },
      marginRight: { default: "2px", ":hover": 4 },
      marginBottom: { default: "1px", ":hover": 4 },
      marginLeft: { default: "2px", ":hover": 4 },
    });
  });

  test("nested conditions survive", () => {
    const nested = {
      default: "1px",
      "@media (min-width: 800px)": { default: "2px", ":hover": "3px" },
    };
    expect(expand({ gap: nested }).style.rowGap).toEqual(nested);
    expect(expand({ gap: nested }).style.columnGap).toEqual(nested);
  });

  test("a malformed branch keeps the whole property and reports the path", () => {
    const result = expand({ margin: { default: 1, ":hover": "1px 2px 3px 4px 5px" } });
    expect(result.style.margin).toEqual({ default: 1, ":hover": "1px 2px 3px 4px 5px" });
    expect(result.diagnostics[0]?.property).toBe("margin[:hover]");
  });

  test("non-shorthands pass through untouched and unknown properties are kept", () => {
    expect(expand({ color: "red", marginTop: "1px", madeUp: 3 }).style).toEqual({
      color: "red",
      marginTop: "1px",
      madeUp: 3,
    });
  });

  test("light-dark() becomes a prefers-color-scheme conditional, also inside shorthands", () => {
    const dark = "@media (prefers-color-scheme: dark)";
    expect(expand({ color: "light-dark(black, white)" }).style.color).toEqual({
      default: "black",
      [dark]: "white",
    });
    const border = expand({ border: "1px solid light-dark(#000, rgb(255, 255, 255))" }).style;
    expect(border.borderTopColor).toEqual({ default: "#000", [dark]: "rgb(255, 255, 255)" });
    expect(border.borderTopWidth).toEqual({ default: "1px", [dark]: "1px" });
    expect(expand({ color: { ":hover": "light-dark(a, b)" } }).style.color).toEqual({
      ":hover": { default: "a", [dark]: "b" },
    });
    expect(expand({ color: "light-dark(a)" }).style.color).toBe("light-dark(a)"); // malformed: left alone
  });
});
