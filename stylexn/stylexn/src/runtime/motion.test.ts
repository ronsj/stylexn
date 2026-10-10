import { describe, expect, test, vi } from "vitest";
import {
  canInterpolate,
  EASE,
  expandTransitionProperty,
  parseEasing,
  pointsCurve,
  stepsCurve,
  parseMotion,
  parseTime,
  parseTransform,
  sameTransformShape,
  timingFor,
} from "./motion.ts";

const warn = vi.fn();

describe("parseTime / parseEasing", () => {
  test("times", () => {
    expect(parseTime("150ms")).toBe(150);
    expect(parseTime("0.3s")).toBe(300);
    expect(parseTime(200)).toBe(200);
    expect(parseTime("fast")).toBeNull();
  });

  test("easing keywords, cubic-bezier, and fallbacks", () => {
    expect(parseEasing("ease", warn)).toBe(EASE);
    expect(parseEasing("linear", warn)).toEqual({ type: "linear" });
    expect(parseEasing("cubic-bezier(0.4, 0, 0.2, 1)", warn)).toEqual({
      type: "bezier",
      x1: 0.4,
      y1: 0,
      x2: 0.2,
      y2: 1,
    });
    expect(parseEasing("bounce", warn)).toEqual({ type: "linear" });
    expect(warn).toHaveBeenCalledWith("easing:bounce", expect.stringMatching(/linear/));
  });

  test("steps() and the step keywords", () => {
    expect(parseEasing("steps(4, end)", warn)).toEqual({
      type: "steps",
      count: 4,
      position: "jump-end",
    });
    expect(parseEasing("steps(3)", warn)).toMatchObject({ count: 3, position: "jump-end" });
    expect(parseEasing("steps(2, jump-both)", warn)).toMatchObject({ position: "jump-both" });
    expect(parseEasing("step-start", warn)).toEqual({
      type: "steps",
      count: 1,
      position: "jump-start",
    });
    expect(parseEasing("step-end", warn)).toEqual({
      type: "steps",
      count: 1,
      position: "jump-end",
    });
    // Malformed: zero steps, jump-none with one step, unknown position.
    for (const bad of ["steps(0)", "steps(1, jump-none)", "steps(2, middle)"]) {
      expect(parseEasing(bad, warn)).toEqual({ type: "linear" });
    }
    expect(warn).toHaveBeenCalledTimes(3);
  });

  test("linear() stops: missing inputs are spread, inputs never decrease", () => {
    expect(parseEasing("linear(0, 1)", warn)).toEqual({
      type: "points",
      points: [
        [0, 0],
        [1, 1],
      ],
    });
    expect(parseEasing("linear(0, 0.25, 1)", warn)).toMatchObject({
      points: [
        [0, 0],
        [0.5, 0.25],
        [1, 1],
      ],
    });
    // Two percentages make a flat segment; an input below the running maximum is raised to it.
    expect(parseEasing("linear(0, 0.5 25% 75%, 0.2 50%, 1)", warn)).toMatchObject({
      points: [
        [0, 0],
        [0.25, 0.5],
        [0.75, 0.5],
        [0.75, 0.2],
        [1, 1],
      ],
    });
    expect(parseEasing("linear(1)", warn)).toEqual({ type: "linear" });
    expect(parseEasing("linear(0, 1 10px)", warn)).toEqual({ type: "linear" });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

/** A curve sampled at the start, the ends of the first and last tenth, the middle and the end. */
const at = (curve: (t: number) => number) => [0, 0.1, 0.5, 0.9, 1].map(curve);

describe("easing curves", () => {
  test("steps: each position jumps where CSS says", () => {
    expect(at(stepsCurve(2, "jump-end"))).toEqual([0, 0, 0.5, 0.5, 1]);
    expect(at(stepsCurve(2, "jump-start"))).toEqual([0.5, 0.5, 1, 1, 1]);
    expect(at(stepsCurve(3, "jump-none"))).toEqual([0, 0, 0.5, 1, 1]);
    expect(at(stepsCurve(2, "jump-both")).map((v) => Math.round(v * 3) / 3)).toEqual([
      1 / 3,
      1 / 3,
      2 / 3,
      2 / 3,
      1,
    ]);
    expect(at(stepsCurve(1, "jump-start"))).toEqual([1, 1, 1, 1, 1]); // step-start
    expect(at(stepsCurve(1, "jump-end"))).toEqual([0, 0, 0, 0, 1]); // step-end
  });

  test("points: piecewise linear with extrapolation past the ends", () => {
    const curve = pointsCurve([
      [0, 0],
      [0.5, 1],
      [1, 0.5],
    ]);
    expect([0, 0.25, 0.5, 0.75, 1].map(curve)).toEqual([0, 0.5, 1, 0.75, 0.5]);
    expect(curve(-0.5)).toBe(-1); // continues the first segment
    expect(curve(1.5)).toBe(0); // continues the last segment
    // Coincident inputs (a flat step) resolve to the later point at that input.
    const step = pointsCurve([
      [0, 0],
      [0.5, 0],
      [0.5, 1],
      [1, 1],
    ]);
    expect([0.25, 0.5, 0.75].map(step)).toEqual([0, 1, 1]);
  });
});

describe("transition specs", () => {
  test("property names map to React Native keys, shorthands expand", () => {
    expect(expandTransitionProperty("background-color")).toEqual(["backgroundColor"]);
    expect(expandTransitionProperty("opacity")).toEqual(["opacity"]);
    expect(expandTransitionProperty("border-color")).toEqual([
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ]);
    expect(expandTransitionProperty("inline-size")).toEqual(["width"]);
  });

  test("lists cycle like CSS; `all` is the fallback", () => {
    const { transition } = parseMotion(
      {
        transitionProperty: "opacity, transform, all",
        transitionDuration: "100ms, 200ms",
        transitionDelay: "50ms",
        transitionTimingFunction: "linear",
      },
      warn,
    );
    expect(transition?.keys.get("opacity")).toEqual({
      duration: 100,
      delay: 50,
      easing: { type: "linear" },
    });
    expect(transition?.keys.get("transform")?.duration).toBe(200);
    expect(transition?.all?.duration).toBe(100);
    expect(timingFor(transition!, "color")?.duration).toBe(100);
    expect(
      timingFor(parseMotion({ transitionProperty: "opacity" }, warn).transition!, "color"),
    ).toBeNull();
  });

  test("duration alone means all properties; none disables", () => {
    expect(parseMotion({ transitionDuration: "1s" }, warn).transition?.all?.duration).toBe(1000);
    expect(
      parseMotion({ transitionProperty: "none", transitionDuration: "1s" }, warn).transition,
    ).toBeUndefined();
  });
});

describe("animation specs", () => {
  test("defaults and list cycling", () => {
    const { animations } = parseMotion(
      {
        animationName: "spin, fade",
        animationDuration: "1s",
        animationIterationCount: "infinite, 2",
        animationDirection: "alternate",
        animationFillMode: "forwards",
      },
      warn,
    );
    expect(animations).toEqual([
      {
        name: "spin",
        duration: 1000,
        delay: 0,
        easing: EASE,
        iterations: Infinity,
        direction: "alternate",
        fillMode: "forwards",
        playState: "running",
      },
      expect.objectContaining({ name: "fade", iterations: 2 }),
    ]);
    expect(parseMotion({ animationName: "none" }, warn).animations).toBeUndefined();
  });
});

describe("transforms", () => {
  test("strings parse to React Native's array form", () => {
    expect(parseTransform("translate(10px, 20%) rotate(45deg) scale(1.5)")).toEqual([
      { translateX: 10 },
      { translateY: "20%" },
      { rotate: "45deg" },
      { scale: 1.5 },
    ]);
    expect(parseTransform("scale(1, 2) skew(10deg)")).toEqual([
      { scaleX: 1 },
      { scaleY: 2 },
      { skewX: "10deg" },
    ]);
    expect(parseTransform("none")).toEqual([]);
    expect(parseTransform("matrix(1,0,0,1,0,0)")).toBeNull();
    expect(parseTransform(4)).toBeNull();
  });

  test("shape comparison and interpolability", () => {
    expect(sameTransformShape([{ rotate: "0deg" }], [{ rotate: "90deg" }])).toBe(true);
    expect(sameTransformShape([{ rotate: "0deg" }], [{ scale: 1 }])).toBe(false);
    expect(canInterpolate(0, 1)).toBe(true);
    expect(canInterpolate("red", "#00f")).toBe(true);
    expect(canInterpolate("10%", "50%")).toBe(true);
    expect(canInterpolate("10%", "50px")).toBe(false);
    expect(canInterpolate("auto", 10)).toBe(false);
  });
});
