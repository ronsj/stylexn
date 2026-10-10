/**
 * Transitions and animations: parse the CSS longhands (as they come out of
 * the compiler, after shorthand expansion) into specs the Animated-backed
 * controller in animated.ts can run. Pure; no React Native imports.
 */
import { propertyEntries } from "../compat/table.ts";
import { isFunction, looksLikeColor, splitComma, splitSpace } from "../expand/tokenize.ts";
import type { RNLeaf } from "../lower/lower.ts";
import { toNumber } from "../lower/units.ts";

export type StepPosition = "jump-start" | "jump-end" | "jump-none" | "jump-both";

export type EasingSpec = Readonly<
  | { type: "linear" }
  | { type: "bezier"; x1: number; y1: number; x2: number; y2: number }
  /** `steps()`, `step-start`, `step-end`: run as a JS easing function. */
  | { type: "steps"; count: number; position: StepPosition }
  /** `linear(<stops>)`: piecewise-linear `[input, output]` points, inputs ascending. */
  | { type: "points"; points: readonly (readonly [number, number])[] }
>;

export type Timing = Readonly<{ duration: number; delay: number; easing: EasingSpec }>;

export type TransitionSpec = Readonly<{
  /** Timing for keys not listed in `keys` (`transition-property: all`), or null. */
  all: Timing | null;
  /** React Native style key -> timing. */
  keys: ReadonlyMap<string, Timing>;
}>;

export type AnimationDirection = "normal" | "reverse" | "alternate" | "alternate-reverse";
export type AnimationFillMode = "none" | "forwards" | "backwards" | "both";

export type AnimationSpec = Readonly<{
  /** Name returned by `stylex.keyframes`. */
  name: string;
  duration: number;
  delay: number;
  easing: EasingSpec;
  /** `Infinity` for `infinite`. */
  iterations: number;
  direction: AnimationDirection;
  fillMode: AnimationFillMode;
  playState: "running" | "paused";
}>;

export type Motion = Readonly<{
  transition?: TransitionSpec;
  animations?: readonly AnimationSpec[];
}>;

/** Style keys that describe motion rather than appearance. */
export const MOTION_KEY = /^(transition|animation)([A-Z]|$)/;

export const EASE: EasingSpec = { type: "bezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
const LINEAR: EasingSpec = { type: "linear" };
const KEYWORD_EASINGS: Readonly<Record<string, EasingSpec>> = {
  ease: EASE,
  linear: LINEAR,
  "ease-in": { type: "bezier", x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "ease-out": { type: "bezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "ease-in-out": { type: "bezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

/** A CSS `<time>` in milliseconds. Bare numbers are taken as milliseconds. */
export function parseTime(token: string | number): number | null {
  if (typeof token === "number") return token;
  const m = token.trim().match(/^(-?\d*\.?\d+)(ms|s)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2]?.toLowerCase() === "s" ? n * 1000 : n;
}

export type Warn = (key: string, message: string) => void;

const STEP_POSITIONS: Readonly<Record<string, StepPosition>> = {
  "jump-start": "jump-start",
  start: "jump-start",
  "jump-end": "jump-end",
  end: "jump-end",
  "jump-none": "jump-none",
  "jump-both": "jump-both",
};

/** `steps(<count>[, <position>])`, or undefined when malformed. */
function parseSteps(args: string): EasingSpec | undefined {
  const [countToken, positionToken, ...rest] = args.split(",").map((a) => a.trim());
  if (rest.length) return undefined;
  const count = Number(countToken);
  if (!Number.isInteger(count) || count < 1) return undefined;
  const position = positionToken === undefined ? "jump-end" : STEP_POSITIONS[positionToken];
  if (!position || (position === "jump-none" && count < 2)) return undefined;
  return { type: "steps", count, position };
}

/**
 * `linear(<stop>#)` where a stop is `<number> <percentage>{0,2}`: the
 * CSS algorithm for missing inputs (first 0, last 1, the rest spread evenly
 * between their neighbours) and non-decreasing inputs. Undefined when malformed.
 */
function parseLinearPoints(args: string): EasingSpec | undefined {
  const points: { output: number; input?: number }[] = [];
  for (const stop of splitComma(args)) {
    const [outputToken, ...inputs] = splitSpace(stop);
    const output = Number(outputToken);
    if (outputToken === undefined || !Number.isFinite(output) || inputs.length > 2) {
      return undefined;
    }
    if (inputs.length === 0) points.push({ output });
    for (const token of inputs) {
      const m = token.match(/^(-?\d*\.?\d+)%$/);
      if (!m) return undefined;
      points.push({ output, input: Number(m[1]) / 100 });
    }
  }
  if (points.length < 2) return undefined;
  const first = points[0] as { output: number; input?: number };
  const last = points[points.length - 1] as { output: number; input?: number };
  first.input ??= 0;
  last.input ??= 1;
  let largest = -Infinity;
  for (const point of points) {
    if (point.input === undefined) continue;
    point.input = Math.max(point.input, largest);
    largest = point.input;
  }
  for (let i = 0; i < points.length; i++) {
    if ((points[i] as { input?: number }).input !== undefined) continue;
    let j = i;
    while ((points[j] as { input?: number }).input === undefined) j++;
    const from = (points[i - 1] as { input: number }).input;
    const to = (points[j] as { input: number }).input;
    for (let k = i; k < j; k++) {
      (points[k] as { input?: number }).input = from + ((to - from) * (k - i + 1)) / (j - i + 1);
    }
    i = j;
  }
  return { type: "points", points: points.map((p) => [p.input as number, p.output] as const) };
}

/** Keyword, `cubic-bezier()`, `steps()` or `linear()`. Unknown functions fall back to linear. */
export function parseEasing(token: string, warn: Warn): EasingSpec {
  const t = token.trim().toLowerCase();
  const keyword = KEYWORD_EASINGS[t];
  if (keyword) return keyword;
  if (t === "step-start") return { type: "steps", count: 1, position: "jump-start" };
  if (t === "step-end") return { type: "steps", count: 1, position: "jump-end" };
  const fn = t.match(/^([a-z-]+)\((.*)\)$/s);
  if (fn) {
    const [, name, args] = fn as [string, string, string];
    let spec: EasingSpec | undefined;
    if (name === "cubic-bezier") {
      const nums = args.split(",").map((n) => Number(n.trim()));
      if (nums.length === 4 && nums.every(Number.isFinite)) {
        const [x1, y1, x2, y2] = nums as [number, number, number, number];
        spec = { type: "bezier", x1, y1, x2, y2 };
      }
    } else if (name === "steps") spec = parseSteps(args);
    else if (name === "linear") spec = parseLinearPoints(args);
    if (spec) return spec;
  }
  warn(`easing:${t}`, `unknown timing function "${token}"; using linear`);
  return LINEAR;
}

/**
 * The CSS step easing as a progress function: `count` steps, jumping at the
 * start, the end, both or neither (jump-none lands on 0 and 1 exactly).
 */
export function stepsCurve(count: number, position: StepPosition): (t: number) => number {
  const jumps = position === "jump-none" ? count - 1 : position === "jump-both" ? count + 1 : count;
  const lead = position === "jump-start" || position === "jump-both" ? 1 : 0;
  return (t) => {
    const step = Math.min(jumps, Math.max(0, Math.floor(t * count) + lead));
    return step / jumps;
  };
}

/** `linear()` points as a progress function, extrapolating past the ends like CSS. */
export function pointsCurve(points: readonly (readonly [number, number])[]): (t: number) => number {
  return (t) => {
    const n = points.length;
    let i = 1;
    while (i < n - 1 && t >= (points[i] as readonly [number, number])[0]) i++;
    const [x0, y0] = points[i - 1] as readonly [number, number];
    const [x1, y1] = points[i] as readonly [number, number];
    if (x1 === x0) return t < x0 ? y0 : y1;
    return y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  };
}

const camel = (prop: string): string =>
  prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * React Native style keys a `transition-property` item covers: CSS names are
 * camelCased, renamed like the compiler does, and shorthands expand to the
 * longhands the table lists (`border-color` -> the four side colors).
 */
export function expandTransitionProperty(prop: string): string[] {
  const name = camel(prop.trim());
  const entry = propertyEntries[name];
  if (entry?.expandsTo) return entry.expandsTo.flatMap(expandTransitionProperty);
  return [entry?.native ?? name];
}

const list = (value: string | undefined): string[] =>
  value === undefined ? [] : splitComma(value);
const cycle = <T>(items: readonly T[], i: number, fallback: T): T =>
  items.length ? (items[i % items.length] as T) : fallback;

/** Build motion specs from resolved `transition*` / `animation*` declarations. */
export function parseMotion(decls: Readonly<Record<string, string>>, warn: Warn): Motion {
  const out: { transition?: TransitionSpec; animations?: AnimationSpec[] } = {};

  if (decls.transitionProperty !== undefined || decls.transitionDuration !== undefined) {
    const props = list(decls.transitionProperty ?? "all");
    const durations = list(decls.transitionDuration).map((t) => parseTime(t) ?? 0);
    const delays = list(decls.transitionDelay).map((t) => parseTime(t) ?? 0);
    const easings = list(decls.transitionTimingFunction).map((e) => parseEasing(e, warn));
    let all: Timing | null = null;
    const keys = new Map<string, Timing>();
    props.forEach((prop, i) => {
      const timing: Timing = {
        duration: Math.max(0, cycle(durations, i, 0)),
        delay: cycle(delays, i, 0),
        easing: cycle(easings, i, EASE),
      };
      const name = prop.trim().toLowerCase();
      if (name === "none") return;
      if (name === "all") all = timing;
      else for (const key of expandTransitionProperty(prop)) keys.set(key, timing);
    });
    if (all || keys.size) out.transition = { all, keys };
  }

  if (decls.animationName !== undefined) {
    const names = list(decls.animationName);
    const durations = list(decls.animationDuration).map((t) => parseTime(t) ?? 0);
    const delays = list(decls.animationDelay).map((t) => parseTime(t) ?? 0);
    const easings = list(decls.animationTimingFunction).map((e) => parseEasing(e, warn));
    const counts = list(decls.animationIterationCount).map((c) =>
      c.trim() === "infinite" ? Infinity : Math.max(0, Number(c) || 0),
    );
    const directions = list(decls.animationDirection) as AnimationDirection[];
    const fills = list(decls.animationFillMode) as AnimationFillMode[];
    const states = list(decls.animationPlayState) as AnimationSpec["playState"][];
    const animations = names
      .map((name, i) => ({
        name: name.trim(),
        duration: Math.max(0, cycle(durations, i, 0)),
        delay: cycle(delays, i, 0),
        easing: cycle(easings, i, EASE),
        iterations: cycle(counts, i, 1),
        direction: cycle(directions, i, "normal"),
        fillMode: cycle(fills, i, "none"),
        playState: cycle(states, i, "running"),
      }))
      .filter((a) => a.name !== "" && a.name !== "none");
    if (animations.length) out.animations = animations;
  }
  return out;
}

/** Timing for a style key under a transition spec, or null when the key does not transition. */
export function timingFor(spec: TransitionSpec, key: string): Timing | null {
  return spec.keys.get(key) ?? spec.all;
}

// ---------------------------------------------------------------------------
// Transforms: Animated cannot interpolate a transform string; React Native
// accepts the array form, whose parts can be interpolated one by one.
// ---------------------------------------------------------------------------

export type TransformPart = Readonly<Record<string, string | number>>;

const ANGLE = /^-?\d*\.?\d+(deg|rad)$/i;
const angle = (t: string): string => (t === "0" || t === "0deg" ? "0deg" : ANGLE.test(t) ? t : t);
const length = (t: string): string | number => toNumber(t) ?? t;
const number = (t: string): number => Number(t);

/** Parse a CSS transform string into React Native's array form; null when it cannot be. */
export function parseTransform(value: RNLeaf): TransformPart[] | null {
  if (Array.isArray(value)) return value as unknown as TransformPart[];
  if (typeof value !== "string") return null;
  if (value.trim() === "none" || value.trim() === "") return [];
  const out: TransformPart[] = [];
  for (const token of splitSpace(value)) {
    if (!isFunction(token)) return null;
    const open = token.indexOf("(");
    const fn = token.slice(0, open);
    const args = splitComma(token.slice(open + 1, -1)).map((a) => a.trim());
    const [a = "0", b] = args as [string?, string?];
    switch (fn) {
      case "translate":
        out.push({ translateX: length(a) });
        if (b !== undefined) out.push({ translateY: length(b) });
        break;
      case "translateX":
      case "translateY":
        out.push({ [fn]: length(a) });
        break;
      case "scale":
        if (b !== undefined && b !== a) out.push({ scaleX: number(a) }, { scaleY: number(b) });
        else out.push({ scale: number(a) });
        break;
      case "scaleX":
      case "scaleY":
      case "perspective":
        out.push({ [fn]: number(a) });
        break;
      case "rotate":
      case "rotateX":
      case "rotateY":
      case "rotateZ":
      case "skewX":
      case "skewY":
        out.push({ [fn]: angle(a) });
        break;
      case "skew":
        out.push({ skewX: angle(a) });
        if (b !== undefined) out.push({ skewY: angle(b) });
        break;
      default:
        return null; // matrix(), translate3d(), ...
    }
  }
  return out;
}

const UNIT_STRING = /^(-?\d*\.?\d+)([a-z%]*)$/i;

/** Whether Animated can interpolate between two leaf values of the same key. */
export function canInterpolate(a: RNLeaf, b: RNLeaf): boolean {
  if (typeof a === "number" && typeof b === "number") return true;
  if (typeof a === "string" && typeof b === "string") {
    if (looksLikeColor(a) && looksLikeColor(b)) return true;
    const ua = a.match(UNIT_STRING);
    const ub = b.match(UNIT_STRING);
    return ua !== null && ub !== null && ua[2] === ub[2];
  }
  return false;
}

/** Two transform arrays with the same functions in the same order. */
export function sameTransformShape(
  a: readonly TransformPart[],
  b: readonly TransformPart[],
): boolean {
  return (
    a.length === b.length && a.every((p, i) => Object.keys(p)[0] === Object.keys(b[i] ?? {})[0])
  );
}
