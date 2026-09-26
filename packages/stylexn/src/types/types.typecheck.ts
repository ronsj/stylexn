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
// @ts-expect-error float has no native behavior
const notNative: NativeProperty = "float";
// @ts-expect-error structural selectors are unsupported
const notPseudo: SupportedPseudoClass = ":first-child";
void [unsupported, native, pseudo, notNative, notPseudo];

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

// --- keyframes are checked like rules ---------------------------------------

const fade = nativeKeyframes({ from: { opacity: 0 }, to: { opacity: 1, transform: "scale(1)" } });
void fade;
nativeKeyframes({
  from: {
    // @ts-expect-error unsupported property in a keyframe
    float: "left",
  },
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
