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
 * Opacity and transform run on the native driver (see `config.nativeDriver`);
 * everything else on the JS driver. Keyframe cycles are scheduled here rather
 * than with Animated.sequence/loop so that pause/resume can continue from the
 * current progress and a delay can show the base style (`fill-mode: none`).
 *
 * Known simplifications: interrupted string/color transitions restart from
 * the nearer end; resuming during a delay restarts the delay; `steps()`
 * easing runs as linear; a removed key animates to a CSS initial value only
 * for the keys in INITIAL_VALUES, otherwise it jumps.
 */
import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import type { CompiledRule } from "../compile/compile.ts";
import type { RNLeaf } from "../lower/lower.ts";
import { config } from "./env.ts";
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

/** Keys Animated can drive on the native thread. */
const NATIVE_KEYS: ReadonlySet<string> = new Set(["opacity", "transform"]);
const nativeDriverFor = (keys: Iterable<string>): boolean =>
  config.nativeDriver && [...keys].every((k) => NATIVE_KEYS.has(k));

/** CSS initial values a transition can animate to when a key leaves the style. */
const INITIAL_VALUES: Readonly<Record<string, RNLeaf>> = {
  opacity: 1,
  backgroundColor: "transparent",
  borderTopColor: "transparent",
  borderRightColor: "transparent",
  borderBottomColor: "transparent",
  borderLeftColor: "transparent",
  shadowOpacity: 0,
};
const IDENTITY_PART: Readonly<Record<string, RNLeaf>> = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: "0deg",
  rotateX: "0deg",
  rotateY: "0deg",
  rotateZ: "0deg",
  skewX: "0deg",
  skewY: "0deg",
};

/** The value a removed key animates to, or undefined when unknown. */
function initialFor(key: string, previous: RNLeaf): RNLeaf | undefined {
  if (key === "transform") {
    const parts = parseTransform(previous);
    if (!parts) return undefined;
    const identity = parts.map((part) => {
      const name = Object.keys(part)[0] as string;
      const value = IDENTITY_PART[name];
      return value === undefined ? null : { [name]: value };
    });
    return identity.every((p) => p !== null) ? (identity as unknown as RNLeaf) : undefined;
  }
  return INITIAL_VALUES[key];
}

function timing(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing: EasingSpec | undefined,
  useNativeDriver: boolean,
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: easing ? easingFn(easing) : undefined,
    useNativeDriver,
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
  /** True once the last animation ran to completion. */
  settled = true;
  /** The key left the style; the transition runs to its initial value, then goes away. */
  removing = false;
  private last = 1;
  private readonly listener: string;
  private running: Animated.CompositeAnimation | null = null;
  private pending: Timing | null = null;

  constructor(key: string) {
    this.key = key;
    // Progress is tracked through a listener: with the native driver the JS
    // side does not know the mid-animation value otherwise.
    this.listener = this.progress.addListener(({ value }) => {
      this.last = value;
    });
  }

  /** Point the transition at `to`, starting from whatever is on screen. False if not animatable. */
  retarget(from: RNLeaf, to: RNLeaf, t: Timing): boolean {
    this.running?.stop();
    this.running = null;
    const start = this.node === null ? from : displayed(this.from, this.to, this.last);
    const node = nodesFor(this.progress, this.key, [0, 1], [start, to]);
    if (node === undefined) return false;
    this.from = start;
    this.to = to;
    this.node = node;
    this.pending = t;
    this.settled = false;
    this.progress.setValue(0);
    return true;
  }

  start(): void {
    const t = this.pending;
    if (!t) return;
    this.pending = null;
    this.running = Animated.timing(this.progress, {
      toValue: 1,
      duration: t.duration,
      delay: t.delay,
      easing: easingFn(t.easing),
      useNativeDriver: nativeDriverFor([this.key]),
    });
    this.running.start(({ finished }) => {
      this.running = null;
      if (finished) this.settled = true;
    });
  }

  stop(): void {
    this.running?.stop();
    this.running = null;
    this.progress.removeListener(this.listener);
  }
}

const fillsForward = (fill: AnimationSpec["fillMode"]) => fill === "forwards" || fill === "both";
const fillsBackward = (fill: AnimationSpec["fillMode"]) => fill === "backwards" || fill === "both";

/** Everything but the play state: changing anything else restarts the animation. */
const signatureOf = (spec: AnimationSpec, reducedMotion: boolean): string =>
  JSON.stringify({ ...spec, playState: undefined, reducedMotion });

class KeyframeRun {
  readonly signature: string;
  readonly nodes: Record<string, unknown> = {};
  finished = false;
  /** Delay with no backwards fill: the base style shows until the animation starts. */
  waiting = false;
  private readonly spec: AnimationSpec;
  private readonly progress: Animated.Value;
  private readonly listener: string;
  private readonly nativeDriver: boolean;
  private readonly iterations: number;
  private readonly forwardFirst: boolean;
  private readonly alternate: boolean;
  private readonly keepsEnd: boolean;
  private readonly onEnd: () => void;
  private readonly invalidate: () => void;
  private cycle = 0;
  private begun = false;
  private paused: boolean;
  private last: number;
  private current: Animated.CompositeAnimation | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    spec: AnimationSpec,
    keyframes: Keyframes,
    base: Style,
    env: MotionEnv,
    signature: string,
    invalidate: () => void,
    warn: Warn,
  ) {
    this.spec = spec;
    this.signature = signature;
    this.invalidate = invalidate;
    this.onEnd = invalidate;
    this.keepsEnd = fillsForward(spec.fillMode);
    this.forwardFirst = spec.direction === "normal" || spec.direction === "alternate";
    this.alternate = spec.direction === "alternate" || spec.direction === "alternate-reverse";
    this.iterations = spec.iterations === Infinity ? Infinity : Math.round(spec.iterations);
    this.paused = spec.playState === "paused";
    const lastForward = this.isForward(this.iterations === Infinity ? 0 : this.iterations - 1);
    const endValue = lastForward ? 1 : 0;
    const skip = env.reducedMotion || this.iterations <= 0 || spec.duration <= 0;
    const startValue = skip ? endValue : this.forwardFirst ? 0 : 1;
    this.progress = new Animated.Value(startValue);
    this.last = startValue;
    this.listener = this.progress.addListener(({ value }) => {
      this.last = value;
    });

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
    this.nativeDriver = nativeDriverFor(Object.keys(this.nodes));

    if (skip) {
      this.finished = true;
      return;
    }
    this.waiting = spec.delay > 0 && !fillsBackward(spec.fillMode);
  }

  private isForward(cycle: number): boolean {
    return this.alternate ? (cycle % 2 === 0) === this.forwardFirst : this.forwardFirst;
  }

  /** Begin (after the delay) or resume. Called from commit and on play-state changes. */
  start(): void {
    if (this.finished || this.paused || this.current || this.timer) return;
    if (!this.begun) {
      this.begun = true;
      if (this.spec.delay > 0) {
        this.timer = setTimeout(() => {
          this.timer = null;
          const wasWaiting = this.waiting;
          this.waiting = false;
          this.runCycle();
          if (wasWaiting) this.invalidate(); // attach the nodes now
        }, this.spec.delay);
        return;
      }
      this.runCycle();
      return;
    }
    this.runCycle(this.last); // resume from where it was paused
  }

  private runCycle(from?: number): void {
    if (this.cycle >= this.iterations) {
      this.finished = true;
      this.current = null;
      if (!this.keepsEnd) this.onEnd(); // back to the base style
      return;
    }
    const forward = this.isForward(this.cycle);
    const target = forward ? 1 : 0;
    const start = from ?? (forward ? 0 : 1);
    if (from === undefined) this.progress.setValue(start);
    const remaining = this.spec.duration * Math.abs(target - start);
    this.current = timing(this.progress, target, remaining, this.spec.easing, this.nativeDriver);
    this.current.start(({ finished }) => {
      this.current = null;
      if (!finished) return; // paused or stopped
      this.cycle++;
      this.runCycle();
    });
  }

  setPlayState(state: AnimationSpec["playState"]): void {
    const paused = state === "paused";
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      this.current?.stop();
      this.current = null;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
        this.begun = false; // resuming restarts the delay
      }
    } else {
      this.start();
    }
  }

  stop(): void {
    this.current?.stop();
    this.current = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.progress.removeListener(this.listener);
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
        const changed =
          from !== undefined &&
          !leafEqual(from, to) &&
          !(tr && !tr.removing && leafEqual(tr.to, to));
        if (changed && t && t.duration > 0) {
          if (canTransition(key, from, to)) {
            tr ??= new Transition(key);
            this.transitions.set(key, tr);
            tr.removing = false;
            if (tr.retarget(from, to, t)) this.pending.push(tr);
          } else {
            warn(
              `transition:${key}`,
              `${key}: cannot animate from ${String(from)} to ${String(to)} on native`,
            );
            tr?.stop();
            tr = undefined;
            this.transitions.delete(key);
          }
        } else if (tr?.removing) {
          // The key came back before the removal finished: animate to it.
          tr.removing = false;
          if (t && t.duration > 0 && tr.retarget(from ?? tr.to, to, t)) this.pending.push(tr);
          else {
            tr.stop();
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
      // Keys that left the style animate to their CSS initial value when it is known.
      for (const [key, from] of Object.entries(this.prev)) {
        if (key in style || this.transitions.get(key)?.removing) continue;
        const t = timingFor(transition, key);
        const initial = initialFor(key, from);
        if (!t || t.duration <= 0 || initial === undefined || !canTransition(key, from, initial)) {
          continue;
        }
        const tr = this.transitions.get(key) ?? new Transition(key);
        this.transitions.set(key, tr);
        tr.removing = true;
        if (tr.retarget(from, initial, t)) this.pending.push(tr);
      }
    }
    for (const [key, tr] of this.transitions) {
      if (key in style || !transition) {
        if (!(key in style)) {
          tr.stop();
          this.transitions.delete(key);
        }
        continue;
      }
      // A removal transition stays attached until it has run out.
      if (tr.removing && !tr.settled) {
        out[key] = tr.node;
        animated = true;
      } else {
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
      const signature = signatureOf(spec, env.reducedMotion);
      let run = this.runs.get(i);
      if (!run || run.signature !== signature) {
        run?.stop();
        run = new KeyframeRun(spec, keyframes, style, env, signature, this.invalidate, warn);
        this.runs.set(i, run);
        this.pending.push(run);
      } else {
        run.setPlayState(spec.playState);
      }
      if (run.waiting) return; // base style during the delay
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
