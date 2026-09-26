// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

let reduceMotion = false;
vi.mock("react-native", async () => {
  const fake = await import("./fake-animated.ts");
  return {
    Animated: fake.Animated,
    Easing: fake.Easing,
    Dimensions: {
      get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
      addEventListener: () => ({ remove() {} }),
    },
    Appearance: { getColorScheme: () => "light", addChangeListener: () => ({ remove() {} }) },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(reduceMotion),
      addEventListener: () => ({ remove() {} }),
    },
    Platform: { OS: "ios" },
  };
});

import { create, keyframes } from "./api.ts";
import { setReducedMotion } from "./env.ts";
import { FakeValue, resetFakeAnimated, started, type Recorded } from "./fake-animated.ts";
import { useProps } from "./hooks.ts";
import { resetKeyframesForTesting } from "./keyframes.ts";
import { resetVarsForTesting } from "./vars.ts";
import { resetWarningsForTesting } from "./warn.ts";

type Interp = { $$interpolation: { inputRange: number[]; outputRange: unknown[] } };
const interp = (v: unknown) => (v as Interp).$$interpolation;

beforeEach(() => {
  resetVarsForTesting();
  resetKeyframesForTesting();
  resetFakeAnimated();
  resetWarningsForTesting();
  reduceMotion = false;
  setReducedMotion(false);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("transitions", () => {
  const styles = create({
    box: {
      opacity: { default: 1, ":active": 0.5 },
      backgroundColor: { default: "red", ":active": "blue" },
      width: { default: "10%", ":active": "50%" },
      transitionProperty: "opacity, background-color",
      transitionDuration: "150ms, 300ms",
      transitionTimingFunction: "linear, ease-in",
      transitionDelay: "0s, 20ms",
    },
  });

  test("no transition on mount; a changed value becomes an interpolation and starts after commit", () => {
    const { result } = renderHook(() => useProps([styles.box]));
    expect(result.current.style).toEqual({ opacity: 1, backgroundColor: "red", width: "10%" });
    expect(result.current.animated).toBeUndefined();

    act(() => result.current.onPressIn?.());
    expect(result.current.animated).toBe(true);
    expect(interp(result.current.style.opacity)).toEqual({
      inputRange: [0, 1],
      outputRange: [1, 0.5],
    });
    expect(interp(result.current.style.backgroundColor)).toEqual({
      inputRange: [0, 1],
      outputRange: ["red", "blue"],
    });
    expect(result.current.style.width).toBe("50%"); // not in transition-property

    const timings = started.filter((r) => r.kind === "timing");
    expect(timings.map((t) => t.config)).toEqual([
      { toValue: 1, duration: 150, delay: 0, easing: "linear", useNativeDriver: false },
      {
        toValue: 1,
        duration: 300,
        delay: 20,
        easing: { bezier: [0.42, 0, 1, 1] },
        useNativeDriver: false,
      },
    ]);
  });

  test("returning to the previous value animates back from where the first one got", () => {
    const { result } = renderHook(() => useProps([styles.box]));
    act(() => result.current.onPressIn?.());
    // Let the first transition finish (the fake never advances on its own).
    (result.current.style.opacity as { from: FakeValue }).from.setValue(1);
    act(() => result.current.onPressOut?.());
    expect(interp(result.current.style.opacity).outputRange).toEqual([0.5, 1]);
    expect(started.filter((r) => r.kind === "timing")).toHaveLength(4);

    // Interrupted midway: numbers restart from the interpolated value.
    (result.current.style.opacity as { from: FakeValue }).from.setValue(0.5);
    act(() => result.current.onPressIn?.());
    expect(interp(result.current.style.opacity).outputRange).toEqual([0.75, 0.5]);
  });

  test("transform strings transition per part", () => {
    const s = create({
      a: {
        transform: { default: "rotate(0deg) scale(1)", ":active": "rotate(90deg) scale(1.2)" },
        transitionDuration: "100ms",
      },
    });
    const { result } = renderHook(() => useProps([s.a]));
    act(() => result.current.onPressIn?.());
    const [rotate, scale] = result.current.style.transform as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(interp(rotate.rotate).outputRange).toEqual(["0deg", "90deg"]);
    expect(interp(scale.scale).outputRange).toEqual([1, 1.2]);
  });

  test("values Animated cannot interpolate jump, with a warning", () => {
    const s = create({
      a: { height: { default: "auto", ":active": 100 }, transitionDuration: "100ms" },
    });
    const { result } = renderHook(() => useProps([s.a]));
    act(() => result.current.onPressIn?.());
    expect(result.current.style).toEqual({ height: 100 });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/height: cannot animate/));
  });

  test("prefers-reduced-motion skips transitions", () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useProps([styles.box]));
    act(() => result.current.onPressIn?.());
    expect(result.current.style.opacity).toBe(0.5);
    expect(result.current.animated).toBeUndefined();
  });
});

describe("keyframe animations", () => {
  test("frames become interpolations over their offsets; infinite loops", () => {
    const spin = keyframes({
      from: { transform: "rotate(0deg)" },
      to: { transform: "rotate(360deg)" },
    });
    const pulse = keyframes({ "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.4 } });
    const s = create({
      a: {
        animationName: `${spin}, ${pulse}`,
        animationDuration: "1s, 2s",
        animationIterationCount: "infinite, 3",
        animationTimingFunction: "linear",
      },
    });
    const { result } = renderHook(() => useProps([s.a]));
    expect(result.current.animated).toBe(true);
    const [rotate] = result.current.style.transform as [Record<string, unknown>];
    expect(interp(rotate.rotate)).toEqual({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    expect(interp(result.current.style.opacity)).toEqual({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.4, 1],
    });
    const [loop, seq] = started as [Recorded, Recorded];
    expect(loop.kind).toBe("loop");
    expect(loop.config).toEqual({ iterations: -1, resetBeforeIteration: false });
    expect(seq.kind).toBe("sequence");
    expect(seq.children).toHaveLength(3);
    expect(seq.children?.[0]?.children?.[1]?.config).toMatchObject({ toValue: 1, duration: 2000 });
  });

  test("delay, reverse direction, and fill-mode none restores the base style when done", () => {
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const s = create({
      a: {
        opacity: 0.8,
        animationName: fade,
        animationDuration: "500ms",
        animationDelay: "100ms",
        animationDirection: "reverse",
      },
    });
    const { result } = renderHook(() => useProps([s.a]));
    expect(interp(result.current.style.opacity).outputRange).toEqual([0, 1]);
    const [outer] = started as [Recorded];
    expect(outer.children?.[0]).toMatchObject({ kind: "delay", config: { ms: 100 } });
    // reverse: the cycle first jumps to 1, then runs to 0
    expect(outer.children?.[1]?.children?.[0]?.children?.map((c) => c.config?.toValue)).toEqual([
      1, 0,
    ]);
    act(() => outer.callback?.({ finished: true }));
    expect(result.current.style).toEqual({ opacity: 0.8 });
    expect(result.current.animated).toBeUndefined();
  });

  test("fill-mode forwards keeps the end frame; missing 0%/100% values fall back to the element", () => {
    const grow = keyframes({ "50%": { width: 100 } });
    const s = create({
      a: { width: 10, animationName: grow, animationDuration: "1s", animationFillMode: "forwards" },
    });
    const { result } = renderHook(() => useProps([s.a]));
    expect(interp(result.current.style.width)).toEqual({
      inputRange: [0, 0.5, 1],
      outputRange: [10, 100, 10],
    });
    act(() => (started[0] as Recorded).callback?.({ finished: true }));
    expect(result.current.animated).toBe(true); // still the interpolation, resting at its end
  });

  test("unknown names warn and are ignored; reduced motion jumps to the end state", () => {
    const s = create({ a: { opacity: 0.3, animationName: "nope", animationDuration: "1s" } });
    expect(renderHook(() => useProps([s.a])).result.current.style).toEqual({ opacity: 0.3 });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/"nope"/));

    setReducedMotion(true);
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const t = create({
      a: {
        opacity: 0.3,
        animationName: fade,
        animationDuration: "1s",
        animationFillMode: "forwards",
      },
    });
    const { result } = renderHook(() => useProps([t.a]));
    expect(interp(result.current.style.opacity).outputRange).toEqual([0, 1]);
    expect(started).toHaveLength(0); // nothing runs; progress rests at the end
  });
});
