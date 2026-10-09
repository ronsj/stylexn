/**
 * Type-level tests for Layer 1. This file is compiled by `tsc` (the typecheck
 * script), not run by Vitest: every `@ts-expect-error` must produce an error
 * and everything else must compile, or the typecheck fails.
 */
import { create as nativeCreate, keyframes as nativeKeyframes } from "../runtime/api.ts";
import { defineVars } from "../runtime/vars.ts";
import { create as webCreate } from "../web.ts";
import type { NativeProperty, SupportedPseudoClass, UnsupportedProperty } from "./index.ts";

// --- derived unions ---------------------------------------------------------

const unsupported: UnsupportedProperty = "float";
const native: NativeProperty = "marginTop";
const pseudo: SupportedPseudoClass = ":hover";
const checked: SupportedPseudoClass = ":checked";
// @ts-expect-error float has no native behavior
const notNative: NativeProperty = "float";
// @ts-expect-error structural selectors are unsupported
const notPseudo: SupportedPseudoClass = ":first-child";
void [unsupported, native, pseudo, checked, notNative, notPseudo];

// --- valid rules compile on both entries ------------------------------------

const vars = defineVars({ accent: "red" });

const valid = {
  box: {
    display: "flex",
    position: "absolute",
    padding: "8px 16px",
    marginTop: 4,
    width: { default: "100%", "@media (min-width: 800px)": 512 },
    color: { default: "black", ":hover": "gray", "::placeholder": "silver" },
    opacity: { "@media (prefers-color-scheme: dark)": { default: 0.9, ":active": 1 } },
    fontWeight: 600,
    willChange: "transform", // web-only: allowed, ignored on native
    transform: "rotate(45deg) scale(1.2)", // function syntax is judged by the build check
    transitionProperty: "opacity, transform",
    transitionDuration: "150ms",
    "--brand": "#639",
    backgroundColor: vars.accent,
    borderTopWidth: null,
  },
  fade: (opacity: number) => ({ opacity, paddingTop: 8 }),
} as const;

const n = nativeCreate(valid);
const w = webCreate(valid);
void [n.box.static, n.fade(0.5).static, w.box.display, w.fade(1)];

// --- function syntax is judged by its function name --------------------------

nativeCreate({
  a: {
    transform: "rotate(45deg) scale(1.2)", // listed for transform
    filter: "blur(4px)",
    width: "calc(100% - 8px)", // a value function the table accepts
    marginTop: "min(1rem, 4vw)",
    color: "oklch(70% 0.1 200)",
    backgroundColor: "rgb(0 0 0 / 0.5)",
    display: "var(--mode)", // var() anywhere
    padding: "8px calc(1rem + 2px)", // multi-token: the build check judges it
  },
});
nativeCreate({
  a: {
    // @ts-expect-error not a transform function
    transform: "bogus(1)",
  },
});
webCreate({
  a: {
    // env() is accepted; the build check judges the variable name.
    paddingTop: "env(safe-area-inset-top, 12px)",
    font: "italic 600 16px/1.5 Inter, sans-serif",
    marginTop: "1lh",
    lineHeight: 1.5,
  },
});
webCreate({
  a: {
    // @ts-expect-error attr() has no native value
    width: "attr(data-width)",
  },
});
nativeCreate({
  a: {
    // @ts-expect-error a transform function is not a length
    width: "rotate(1deg)",
  },
});
webCreate({
  a: {
    // @ts-expect-error display takes keywords, not calc()
    display: "calc(1)",
  },
});

// --- style-to-prop mappings narrow to the listed values ----------------------

nativeCreate({
  list: {
    scrollSnapType: "x mandatory",
    scrollSnapAlign: "center",
    scrollSnapStop: "always",
    overscrollBehavior: "contain",
    scrollPadding: "8px 16px",
  },
  text: { hyphens: "auto", fontFeatureSettings: `"tnum" 1, "smcp"` },
});
nativeCreate({
  a: {
    // @ts-expect-error a strictness alone is not a snap type
    scrollSnapType: "mandatory",
    // @ts-expect-error one keyword: React Native has no per-axis overscroll
    overscrollBehavior: "contain none",
  },
});

// --- keyframes: selectors and plain values --------------------------------------

import { keyframes as webKeyframes } from "../web.ts";

const fade = nativeKeyframes({
  from: { opacity: 0 },
  "50%": { opacity: 0.5 },
  "0%, 100%": { transform: "scale(1)" },
  to: { opacity: 1, transform: "scale(1)" },
});
void [fade, webKeyframes({ from: { opacity: 0 }, to: { opacity: 1 } })];
nativeKeyframes({
  from: {
    // @ts-expect-error unsupported property in a keyframe
    float: "left",
  },
});
webKeyframes({
  // @ts-expect-error not a keyframe selector
  middle: { opacity: 0.5 },
});
nativeKeyframes({
  from: {
    // @ts-expect-error frames take plain values, not conditions
    opacity: { default: 0, ":hover": 1 },
  },
});
webKeyframes({
  to: {
    // @ts-expect-error grid is not a native display value
    display: "grid",
  },
});

// --- createTheme overrides match the group's value kinds -------------------------

import { createTheme as nativeCreateTheme } from "../runtime/vars.ts";
import { createTheme as webCreateTheme, defineVars as webDefineVars } from "../web.ts";

const tokens = defineVars({
  accent: "red",
  gap: 8,
  bg: { default: "#fff", "@media (prefers-color-scheme: dark)": "#000" },
});
void nativeCreateTheme(tokens, {
  accent: "blue",
  gap: 12,
  bg: { default: "#eee", "@media (prefers-color-scheme: dark)": "#111" },
});
void nativeCreateTheme(tokens, { gap: tokens.gap }); // a var reference
nativeCreateTheme(tokens, {
  // @ts-expect-error accent is a string variable
  accent: 12,
});
nativeCreateTheme(tokens, {
  // @ts-expect-error gap is a number variable
  gap: "12px",
});
nativeCreateTheme(tokens, {
  // @ts-expect-error not in the group
  other: 1,
});
const webTokens = webDefineVars({ accent: "red", gap: 8 });
void webCreateTheme(webTokens, { accent: "blue", gap: 12 });
webCreateTheme(webTokens, {
  // @ts-expect-error accent is a string variable on web too
  accent: 12,
});

// --- invalid rules are errors on both entries --------------------------------

nativeCreate({
  a: {
    // @ts-expect-error transform takes function syntax, not bare keywords
    transform: "bogus",
  },
});

nativeCreate({
  a: {
    // @ts-expect-error unsupported property
    float: "left",
  },
});
webCreate({
  a: {
    // @ts-expect-error unsupported property
    float: "left",
  },
});

nativeCreate({
  a: {
    // @ts-expect-error grid is not a native display value
    display: "grid",
  },
});
webCreate({
  a: {
    // @ts-expect-error sticky is not a native position value
    position: "sticky",
  },
});

nativeCreate({
  a: {
    color: {
      default: "red",
      // @ts-expect-error structural pseudo-class
      ":first-child": "blue",
    },
  },
});
webCreate({
  a: {
    width: {
      // @ts-expect-error container queries are unsupported
      "@container (min-width: 400px)": "50%",
    },
  },
});

nativeCreate({
  a: {
    opacity: {
      // @ts-expect-error ::placeholder is only valid on color
      "::placeholder": 0.5,
    },
  },
});

nativeCreate({
  a: {
    // @ts-expect-error unknown property
    madeUpProperty: 1,
  },
});

webCreate({
  // @ts-expect-error dynamic rules are checked too
  fade: (x: number) => ({ float: "left", opacity: x }),
});

// --- escape hatches ---------------------------------------------------------

import { native as nativeHatch, web as webHatch } from "../runtime/api.ts";
import { native as webEntryNative, web as webEntryWeb } from "../web.ts";

nativeCreate({
  a: {
    display: "flex",
    ...webHatch({ display: "grid", float: "left", "@container": 1 }), // anything goes on web
    ...nativeHatch({ elevation: 2, shadowColor: "#000", marginBlock: "4px" }),
  },
});
webCreate({
  a: {
    display: "flex",
    ...webEntryWeb({ display: "grid", float: "left" }),
    ...webEntryNative({ elevation: 2, marginBlock: "4px" }),
  },
});

nativeHatch({
  // @ts-expect-error unsupported even inside native()
  float: "left",
});
webEntryNative({
  // @ts-expect-error partial values are still checked inside native()
  display: "grid",
});

// --- relational conditions (when.*) -------------------------------------------

import { defineMarker as nativeDefineMarker, when as nativeWhen } from "../runtime/markers.ts";
import { defineMarker as webDefineMarker, when as webWhen } from "../web.ts";

const cardMarker = nativeDefineMarker();
nativeCreate({
  a: {
    color: {
      default: "black",
      [nativeWhen.ancestor(":hover", cardMarker)]: "blue",
      [nativeWhen.ancestor(":active")]: "red",
    },
    opacity: { default: 1, ":where-ancestor(:disabled, m1)": 0.5 },
  },
});
// @ts-expect-error a structural pseudo-class cannot be evaluated on an ancestor either
void nativeWhen.ancestor(":first-child", cardMarker);
nativeCreate({
  a: {
    color: {
      default: "black",
      // @ts-expect-error a structural pseudo-class on an ancestor
      ":where-ancestor(:first-child, m1)": "blue",
    },
  },
});
webCreate({
  a: {
    color: {
      default: "black",
      // @ts-expect-error descendant conditions need selectors React Native does not have
      ":where-descendant(:hover, m1)": "blue",
    },
  },
});
// StyleX's when.* return `string`: an unknown computed key passes (the build check judges it).
const webMarker = webDefineMarker();
webCreate({
  a: { color: { default: "black", [webWhen.ancestor(":hover", webMarker)]: "blue" } },
});
declare const anyCondition: string;
nativeCreate({ a: { color: { default: "black", [anyCondition]: "blue" } } });

// --- firstThatWorks: accepted when at least one candidate is ------------------

import { firstThatWorks as nativeFirstThatWorks } from "../runtime/api.ts";
import { firstThatWorks as webFirstThatWorks } from "../web.ts";

nativeCreate({
  a: {
    minHeight: nativeFirstThatWorks("100dvh", "100vh"),
    position: nativeFirstThatWorks("sticky", "relative"), // relative is a native value
    color: { default: nativeFirstThatWorks("oklch(70% 0.1 200)", "gray"), ":hover": "black" },
  },
});
webCreate({
  a: {
    minHeight: webFirstThatWorks("100dvh", "100vh"),
    position: webFirstThatWorks("sticky", "relative"),
    color: { default: webFirstThatWorks("oklch(70% 0.1 200)", "gray"), ":hover": "black" },
  },
});
nativeCreate({
  a: {
    // @ts-expect-error neither candidate is a native position
    position: nativeFirstThatWorks("sticky", "fixed"),
  },
});
webCreate({
  a: {
    // @ts-expect-error neither candidate is a native display value
    display: webFirstThatWorks("grid", "block"),
  },
});
nativeKeyframes({ from: { opacity: nativeFirstThatWorks(0, 0.1) }, to: { opacity: 1 } });
