/**
 * Transitions and keyframe animations on React Native, run with the built-in
 * Animated API (JS driver; no extra dependencies, works in Expo Go).
 *
 * - A transitioned key gets a progress `Animated.Value` and an interpolation
 *   node from the previously committed value to the new one; the node stays
 *   in the style (holding the target) until the key changes again.
 * - `animationName` looks up `stylex.keyframes` frames; each key across the
 *   frames becomes one interpolation over the frame offsets, driven by a
 *   progress value that runs the iteration/direction/delay composite.
 * - Transform strings are parsed to React Native's array form so their parts
 *   can be interpolated; the functions must match across the values.
 *
 * Known simplifications: interrupted string/color transitions restart from
 * the nearer end; the first frame shows during an animation's delay; pausing
 * and resuming restarts the animation; `steps()` easing runs as linear.
 */
import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import type { CompiledRule } from "../compile/compile.ts";
import type { RNLeaf } from "../lower/lower.ts";
import { getKeyframes } from "./keyframes.ts";
import type { Keyframes } from "./keyframes.ts";
import {
  canInterpolate,
  parseTransform,
  sameTransformShape,
  timingFor,
  type AnimationSpec,
  type EasingSpec,
  type Motion,
  type Timing,
  type TransformPart,
} from "./motion.ts";
import type { Env } from "./types.ts";
import { warnOnce } from "./warn.ts";

type Style = Readonly<Record<string, RNLeaf>>;
/** A style whose values may be Animated nodes; render it on an Animated component. */
export type AnimatedStyle = Readonly<Record<string, unknown>>;

type Warn = (key: string, message: string) => void;

export type MotionEnv = Readonly<{
  reducedMotion: boolean;
  /** Resolve a keyframe's compiled rule against the current environment (vars, units). */
  resolveFrame: (rule: CompiledRule) => Style;
}>;

const easingFn = (e: EasingSpec) =>
  e.type === "linear" ? Easing.linear : Easing.bezier(e.x1, e.y1, e.x2, e.y2);

function timing(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing?: EasingSpec,
  delay = 0,
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue,
    duration,
    delay,
    easing: easing ? easingFn(easing) : undefined,
    useNativeDriver: false,
  });
}

const leafEqual = (a: RNLeaf | undefined, b: RNLeaf | undefined): boolean =>
  Object.is(a, b) ||
  (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));

/**
 * Interpolation node(s) for one key over `offsets` -> `values`, or undefined
 * when Animated cannot interpolate them. Transforms become an array with one
 * node per part.
 */
function nodesFor(
  progress: Animated.Value,
  key: string,
  offsets: readonly number[],
  values: readonly RNLeaf[],
): unknown | undefined {
  const inputRange = [...offsets];
  if (key === "transform") {
    const parsed = values.map(parseTransform);
    const first = parsed[0];
    if (!first || parsed.some((p) => p === null || !sameTransformShape(first, p))) return undefined;
    const parts = parsed as TransformPart[][];
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < first.length; i++) {
      const name = Object.keys(first[i] as TransformPart)[0] as string;
      const outputRange = parts.map((p) => (p[i] as TransformPart)[name] as string | number);
      const head = outputRange[0] as string | number;
      if (!outputRange.every((v) => canInterpolate(head, v))) return undefined;
      out.push({
        name,
        node: progress.interpolate({ inputRange, outputRange: outputRange as number[] }),
      });
    }
    return out.map((p) => ({ [p.name as string]: p.node }));
  }
  const head = values[0];
  if (head === undefined || !values.every((v) => canInterpolate(head, v))) return undefined;
  return progress.interpolate({ inputRange, outputRange: values as number[] });
}

/** What a transition currently shows, given how far it got. */
function displayed(from: RNLeaf, to: RNLeaf, p: number): RNLeaf {
  if (typeof from === "number" && typeof to === "number") return from + (to - from) * p;
  return p < 0.5 ? from : to;
}

class Transition {
  readonly key: string;
  readonly progress = new Animated.Value(1);
  from: RNLeaf = null;
  to: RNLeaf = null;
  node: unknown = null;
  private running: Animated.CompositeAnimation | null = null;
  private pending: Timing | null = null;

  constructor(key: string) {
    this.key = key;
  }

  /** Point the transition at `to`, starting from whatever is on screen. False if not animatable. */
  retarget(from: RNLeaf, to: RNLeaf, t: Timing): boolean {
    let p = 1;
    this.running?.stop();
    this.running = null;
    this.progress.stopAnimation((v) => {
      p = v;
    });
    const start = this.node === null ? from : displayed(this.from, this.to, p);
    const node = nodesFor(this.progress, this.key, [0, 1], [start, to]);
    if (node === undefined) return false;
    this.from = start;
    this.to = to;
    this.node = node;
    this.pending = t;
    this.progress.setValue(0);
    return true;
  }

  start(): void {
    const t = this.pending;
    if (!t) return;
    this.pending = null;
    this.running = timing(this.progress, 1, t.duration, t.easing, t.delay);
    this.running.start(() => {
      this.running = null;
    });
  }

  stop(): void {
    this.running?.stop();
    this.running = null;
  }
}

const fillsForward = (fill: AnimationSpec["fillMode"]) => fill === "forwards" || fill === "both";

class KeyframeRun {
  readonly signature: string;
  readonly nodes: Record<string, unknown> = {};
  finished = false;
  private readonly progress: Animated.Value;
  private composite: Animated.CompositeAnimation | null = null;
  private readonly onEnd: () => void;
  private readonly keepsEnd: boolean;

  constructor(
    spec: AnimationSpec,
    keyframes: Keyframes,
    base: Style,
    env: MotionEnv,
    signature: string,
    onEnd: () => void,
    warn: Warn,
  ) {
    this.signature = signature;
    this.onEnd = onEnd;
    this.keepsEnd = fillsForward(spec.fillMode);
    const forwardFirst = spec.direction === "normal" || spec.direction === "alternate";
    const alternate = spec.direction === "alternate" || spec.direction === "alternate-reverse";
    const iterations = spec.iterations === Infinity ? Infinity : Math.round(spec.iterations);
    const lastForward = alternate
      ? ((iterations === Infinity ? 0 : iterations - 1) % 2 === 0) === forwardFirst
      : forwardFirst;
    const endValue = lastForward ? 1 : 0;
    const skip = env.reducedMotion || iterations <= 0 || spec.duration <= 0;
    this.progress = new Animated.Value(skip ? endValue : forwardFirst ? 0 : 1);

    // One interpolation per key across the frames that set it.
    const frames = keyframes.frames.map((f) => ({
      offset: f.offset,
      style: env.resolveFrame(f.rule),
    }));
    const keys = new Set(frames.flatMap((f) => Object.keys(f.style)));
    for (const key of keys) {
      const points = new Map<number, RNLeaf>();
      for (const f of frames) if (key in f.style) points.set(f.offset, f.style[key] as RNLeaf); // later frame wins
      const fill = (offset: number) => {
        if (points.has(offset)) return true;
        if (base[key] === undefined) return false;
        points.set(offset, base[key] as RNLeaf);
        return true;
      };
      if (!fill(0) || !fill(1)) {
        warn(
          `keyframes:${spec.name}:${key}`,
          `keyframes ${spec.name}: ${key} needs a value at 0% and 100% (or on the element)`,
        );
        continue;
      }
      // oxlint-disable-next-line unicorn/no-array-sort -- toSorted is not guaranteed on older Hermes
      const offsets = [...points.keys()].sort((a, b) => a - b);
      const node = nodesFor(
        this.progress,
        key,
        offsets,
        offsets.map((o) => points.get(o) as RNLeaf),
      );
      if (node === undefined) {
        warn(
          `keyframes:${spec.name}:${key}`,
          `keyframes ${spec.name}: ${key} values cannot be interpolated on native`,
        );
        continue;
      }
      this.nodes[key] = node;
    }

    if (skip) {
      this.finished = true;
      return;
    }
    if (spec.playState === "paused") return;

    const fwd = () =>
      Animated.sequence([
        timing(this.progress, 0, 0),
        timing(this.progress, 1, spec.duration, spec.easing),
      ]);
    const back = () =>
      Animated.sequence([
        timing(this.progress, 1, 0),
        timing(this.progress, 0, spec.duration, spec.easing),
      ]);
    const cycle = (i: number) =>
      (alternate ? (i % 2 === 0) === forwardFirst : forwardFirst) ? fwd() : back();
    let composite =
      iterations === Infinity
        ? Animated.loop(alternate ? Animated.sequence([cycle(0), cycle(1)]) : cycle(0), {
            iterations: -1,
            resetBeforeIteration: false,
          })
        : Animated.sequence(Array.from({ length: Math.min(iterations, 1000) }, (_, i) => cycle(i)));
    if (spec.delay > 0) composite = Animated.sequence([Animated.delay(spec.delay), composite]);
    this.composite = composite;
  }

  start(): void {
    this.composite?.start(({ finished }) => {
      if (!finished) return;
      this.finished = true;
      this.composite = null;
      if (!this.keepsEnd) this.onEnd(); // back to the base style
    });
  }

  stop(): void {
    this.composite?.stop();
    this.composite = null;
  }
}

const canTransition = (key: string, from: RNLeaf, to: RNLeaf): boolean => {
  if (key === "transform") {
    const a = parseTransform(from);
    const b = parseTransform(to);
    return a !== null && b !== null && sameTransformShape(a, b);
  }
  return canInterpolate(from, to);
};

/**
 * Per-element state machine. `render` is called during render and only
 * prepares work; `commit` (in an effect) starts it and records the style as
 * the new baseline for transitions.
 */
export class MotionController {
  private prev: Style | null = null;
  private next: Style | null = null;
  private readonly transitions = new Map<string, Transition>();
  private readonly runs = new Map<number, KeyframeRun>();
  private pending: Array<{ start(): void }> = [];
  private readonly invalidate: () => void;

  constructor(invalidate: () => void) {
    this.invalidate = invalidate;
  }

  render(
    style: Style,
    motion: Motion,
    env: MotionEnv,
    warn: Warn = warnOnce,
  ): { style: AnimatedStyle; animated: boolean } {
    const out: Record<string, unknown> = { ...style };
    let animated = false;
    this.next = style;

    // Transitions: only for changes after the first commit, like CSS.
    const { transition } = motion;
    if (transition && this.prev && !env.reducedMotion) {
      for (const [key, to] of Object.entries(style)) {
        const from = this.prev[key];
        let tr = this.transitions.get(key);
        const t = timingFor(transition, key);
        const changed = from !== undefined && !leafEqual(from, to) && !(tr && leafEqual(tr.to, to));
        if (changed && t && t.duration > 0) {
          if (canTransition(key, from, to)) {
            tr ??= new Transition(key);
            this.transitions.set(key, tr);
            if (tr.retarget(from, to, t)) this.pending.push(tr);
          } else {
            warn(
              `transition:${key}`,
              `${key}: cannot animate from ${String(from)} to ${String(to)} on native`,
            );
            tr = undefined;
            this.transitions.delete(key);
          }
        }
        if (tr && leafEqual(tr.to, to)) {
          out[key] = tr.node;
          animated = true;
        } else if (tr) {
          tr.stop();
          this.transitions.delete(key);
        }
      }
    }
    for (const [key, tr] of this.transitions) {
      if (!transition || !(key in style)) {
        tr.stop();
        this.transitions.delete(key);
      }
    }

    // Keyframe animations, by position in the animation list.
    const seen = new Set<number>();
    motion.animations?.forEach((spec, i) => {
      const keyframes = getKeyframes(spec.name);
      if (!keyframes) {
        warn(
          `keyframes:${spec.name}`,
          `animationName "${spec.name}" is not a stylex.keyframes() result`,
        );
        return;
      }
      seen.add(i);
      const signature = `${JSON.stringify(spec)}|${env.reducedMotion}`;
      let run = this.runs.get(i);
      if (!run || run.signature !== signature) {
        run?.stop();
        run = new KeyframeRun(spec, keyframes, style, env, signature, this.invalidate, warn);
        this.runs.set(i, run);
        this.pending.push(run);
      }
      if (run.finished && !fillsForward(spec.fillMode)) return;
      if (Object.keys(run.nodes).length) {
        Object.assign(out, run.nodes);
        animated = true;
      }
    });
    for (const [i, run] of this.runs) {
      if (!seen.has(i)) {
        run.stop();
        this.runs.delete(i);
      }
    }
    return { style: out, animated };
  }

  commit(): void {
    this.prev = this.next;
    const pending = this.pending;
    this.pending = [];
    for (const p of pending) p.start();
  }

  dispose(): void {
    for (const tr of this.transitions.values()) tr.stop();
    for (const run of this.runs.values()) run.stop();
    this.transitions.clear();
    this.runs.clear();
    this.pending = [];
  }
}

/**
 * Apply transitions and animations to a resolved style. Allocates a
 * controller only for elements whose rules mention motion (`needed`).
 */
export function useMotion(
  style: Style,
  motion: Motion,
  env: Env,
  needed: boolean,
  resolveFrame: (rule: CompiledRule) => Style,
): { style: AnimatedStyle; animated: boolean } {
  const [, bump] = useState(0);
  const [stored, setStored] = useState<MotionController | null>(null);
  let controller = stored;
  if (needed && !controller) {
    controller = new MotionController(() => bump((n) => n + 1));
    setStored(controller); // derived state: created on the first render that needs it
  }
  const result = controller?.render(style, motion, {
    reducedMotion: env.reducedMotion,
    resolveFrame,
  });
  useEffect(() => {
    controller?.commit();
  });
  useEffect(() => () => controller?.dispose(), [controller]);
  return result ?? { style, animated: false };
}
