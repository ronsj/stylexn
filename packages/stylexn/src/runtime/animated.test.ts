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
    expect(result.current.animated).toBe(true); // an Animated component from the start: no remounts

    act(() => result.current.onPressIn?.());
    expect(interp(result.current.style.opacity)).toEqual({
      inputRange: [0, 1],
      outputRange: [1, 0.5],
    });
    expect(interp(result.current.style.backgroundColor)).toEqual({
      inputRange: [0, 1],
      outputRange: ["red", "blue"],
    });
    expect(result.current.style.width).toBe("50%"); // not in transition-property

    // backgroundColor needs the JS driver, and one element cannot mix drivers:
    // every transition on this element runs on the JS driver.
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

  test("opacity/transform-only elements run on the native driver", () => {
    const s = create({
      a: {
        opacity: { default: 1, ":active": 0.5 },
        transform: { default: "scale(1)", ":active": "scale(0.9)" },
        transitionProperty: "opacity, transform",
        transitionDuration: "100ms",
      },
    });
    const { result } = renderHook(() => useProps([s.a]));
    act(() => result.current.onPressIn?.());
    expect(started.map((r) => r.config?.useNativeDriver)).toEqual([true, true]);
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
    expect(result.current.style.opacity).toBe(0.5); // no interpolation node
  });
});

/** Complete the most recently started fake animation. */
const finishCurrent = () => act(() => (started.at(-1) as Recorded).callback?.({ finished: true }));

describe("keyframe animations", () => {
  test("frames become interpolations over their offsets; cycles run one after another", () => {
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
    // One timing per animation per cycle; both are opacity/transform-only so they run natively.
    expect(started.map((r) => r.config)).toEqual([
      { toValue: 1, duration: 1000, easing: "linear", useNativeDriver: true },
      { toValue: 1, duration: 2000, easing: "linear", useNativeDriver: true },
    ]);
    act(() => (started[0] as Recorded).callback?.({ finished: true }));
    expect(started).toHaveLength(3); // the infinite one started its next cycle
    expect(started[2]?.config).toMatchObject({ toValue: 1, duration: 1000 });
  });

  test("alternate direction, reverse, and fill-mode none restores the base style when done", () => {
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const s = create({
      a: {
        opacity: 0.8,
        animationName: fade,
        animationDuration: "500ms",
        animationDirection: "alternate-reverse",
        animationIterationCount: "2",
      },
    });
    const { result } = renderHook(() => useProps([s.a]));
    expect(interp(result.current.style.opacity).outputRange).toEqual([0, 1]);
    // alternate-reverse: first cycle runs 1 -> 0, the second 0 -> 1
    expect(started[0]?.config).toMatchObject({ toValue: 0, duration: 500 });
    finishCurrent();
    expect(started[1]?.config).toMatchObject({ toValue: 1, duration: 500 });
    finishCurrent();
    expect(result.current.style).toEqual({ opacity: 0.8 });
  });

  test("delay: base style shows until the animation starts unless it fills backwards", () => {
    vi.useFakeTimers();
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const s = create({
      a: { opacity: 0.8, animationName: fade, animationDuration: "500ms", animationDelay: "100ms" },
      b: {
        opacity: 0.8,
        animationName: fade,
        animationDuration: "500ms",
        animationDelay: "100ms",
        animationFillMode: "backwards",
      },
    });
    const none = renderHook(() => useProps([s.a]));
    const backwards = renderHook(() => useProps([s.b]));
    expect(none.result.current.style).toEqual({ opacity: 0.8 });
    expect(interp(backwards.result.current.style.opacity).outputRange).toEqual([0, 1]);
    expect(started).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(started).toHaveLength(2);
    expect(interp(none.result.current.style.opacity).outputRange).toEqual([0, 1]);
    vi.useRealTimers();
  });

  test("pausing stops the current cycle and resuming continues from the current progress", () => {
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const s = create({
      a: (state: string) => ({
        animationName: fade,
        animationDuration: "1s",
        animationPlayState: state,
      }),
    });
    const { result, rerender } = renderHook(({ state }) => useProps([s.a(state)]), {
      initialProps: { state: "running" },
    });
    const first = started[0] as Recorded;
    expect(first.config).toMatchObject({ toValue: 1, duration: 1000 });
    (result.current.style.opacity as { from: FakeValue }).from.setValue(0.25);
    rerender({ state: "paused" });
    expect(first.stopped).toBe(true);
    act(() => first.callback?.({ finished: false }));
    expect(started).toHaveLength(1);
    rerender({ state: "running" });
    expect(started).toHaveLength(2);
    expect(started[1]?.config).toMatchObject({ toValue: 1, duration: 750 }); // the remaining 75%
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
    expect(started[0]?.config).toMatchObject({ useNativeDriver: false }); // width is a layout prop
    finishCurrent();
    expect(interp(result.current.style.width)).toBeDefined(); // still the interpolation, resting at its end
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

describe("removed keys", () => {
  test("a key that leaves the style transitions to its CSS initial value, then goes away", () => {
    const s = create({
      a: {
        opacity: { ":active": 0.5 },
        transform: { ":active": "scale(0.9)" },
        width: { ":active": 100 },
        transitionDuration: "200ms",
      },
    });
    const { result } = renderHook(() => useProps([s.a]));
    act(() => result.current.onPressIn?.());
    expect(result.current.style).toMatchObject({ opacity: 0.5, width: 100 });
    act(() => result.current.onPressOut?.());
    // opacity -> 1, scale -> 1; width has no known initial value and just disappears
    expect(interp(result.current.style.opacity).outputRange).toEqual([0.5, 1]);
    const [scale] = result.current.style.transform as [Record<string, unknown>];
    expect(interp(scale.scale).outputRange).toEqual([0.9, 1]);
    expect(result.current.style.width).toBeUndefined();
    // Once the removal has run out, the next render drops the keys.
    for (const r of started) act(() => r.callback?.({ finished: true }));
    act(() => result.current.onHoverIn?.());
    expect(result.current.style).toEqual({});
  });
});
