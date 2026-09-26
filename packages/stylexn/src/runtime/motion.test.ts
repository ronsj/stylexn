import { describe, expect, test, vi } from "vitest";
import {
  canInterpolate,
  EASE,
  expandTransitionProperty,
  parseEasing,
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
    expect(parseEasing("steps(4, end)", warn)).toEqual({ type: "linear" });
    expect(warn).toHaveBeenCalledWith("easing:steps(4, end)", expect.stringMatching(/linear/));
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
