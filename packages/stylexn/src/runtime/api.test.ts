import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }) },
  Appearance: { getColorScheme: () => "dark" },
  Platform: { OS: "ios" },
}));

import { compileRule } from "../compile/compile.ts";
import { create, firstThatWorks, props } from "./api.ts";
import stylex, { defaultMarker, defineMarker, when } from "./index.ts";
import { createTheme, defineVars, resetVarsForTesting } from "./vars.ts";

beforeEach(() => {
  resetVarsForTesting();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("create", () => {
  test("compiled rules pass through untouched", () => {
    const compiled = compileRule({ color: "red" }).rule;
    const styles = create({ a: compiled });
    expect(styles.a).toBe(compiled);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("uncompiled rules are compiled at runtime with one warning", () => {
    const styles = create({ a: { padding: "4px 8px" }, b: { color: "red" } });
    expect(styles.a.static).toEqual({
      paddingTop: 4,
      paddingRight: 8,
      paddingBottom: 4,
      paddingLeft: 8,
    });
    expect(styles.b.$$stylexn).toBe(1);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  test("a when.ancestor computed key compiles to a condition on the marker id", () => {
    const card = defineMarker();
    const styles = create({
      label: {
        color: {
          default: "black",
          [when.ancestor(":active", card)]: "red",
          [when.ancestor(":hover")]: "blue",
        },
      },
    });
    expect(styles.label.conditional).toEqual([
      { key: "color", when: [`:where-ancestor(:active, ${card.$$stylexnMarker})`], value: "red" },
      { key: "color", when: [":where-ancestor(:hover, default-marker)"], value: "blue" },
    ]);
    // Markers without the plugin get distinct ids from a counter.
    expect(defineMarker().$$stylexnMarker).not.toBe(card.$$stylexnMarker);
    expect(defineMarker("fixed").$$stylexnMarker).toBe("fixed");
    expect(defaultMarker()).toBe(defaultMarker());
  });

  test("dynamic rules", () => {
    const styles = create({ fade: (opacity: number) => ({ opacity }) });
    expect(styles.fade(0.5).static).toEqual({ opacity: 0.5 });
  });
});

describe("props", () => {
  test("returns style plus derived props from a snapshot environment", () => {
    const styles = create({
      a: {
        width: "50vw",
        color: { default: "black", "@media (prefers-color-scheme: dark)": "white" },
      },
      b: { lineClamp: 2 },
    });
    expect(props(styles.a, styles.b)).toEqual({
      numberOfLines: 2,
      style: { width: 195, color: "white" },
    });
  });

  test("interaction conditions never hold outside useProps", () => {
    const styles = create({ a: { color: { default: "red", ":hover": "blue" } } });
    expect(props(styles.a).style.color).toBe("red");
  });

  test("themes in the arguments apply", () => {
    const vars = defineVars({ accent: "red" });
    const styles = create({ a: { color: vars.accent } });
    expect(props(createTheme(vars, { accent: "blue" }), styles.a).style.color).toBe("blue");
  });
});

describe("misc API", () => {
  test("firstThatWorks returns the first value", () => {
    expect(firstThatWorks("sticky", "fixed", "absolute")).toBe("sticky");
  });

  test("default export exposes the StyleX API", () => {
    expect(Object.keys(stylex).toSorted()).toEqual([
      "attrs",
      "create",
      "createTheme",
      "defaultMarker",
      "defineConsts",
      "defineMarker",
      "defineVars",
      "firstThatWorks",
      "keyframes",
      "native",
      "props",
      "web",
      "when",
    ]);
  });
});

describe("escape hatches at runtime (uncompiled fallback)", () => {
  test("web() is empty on native, native() is identity", async () => {
    const { web, native } = await import("./api.ts");
    expect(web({ display: "grid" })).toEqual({});
    expect(Object.keys(native({ elevation: 2 }))).toEqual(["elevation"]);
    const styles = create({
      a: { color: "red", ...web({ float: "left" }), ...native({ elevation: 2 }) },
    });
    expect(styles.a.static).toEqual({ color: "red", elevation: 2 });
  });
});
