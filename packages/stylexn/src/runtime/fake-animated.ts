/**
 * Test double for React Native's Animated: records what the runtime builds
 * (values, interpolations, timings, loops) without running any timers.
 */
import { createElement, type ComponentType } from "react";
import { host } from "../testing/host.ts";

export type Recorded = {
  kind: "timing" | "sequence" | "loop" | "delay";
  config?: Record<string, unknown>;
  children?: Recorded[];
  target?: FakeValue;
  started: boolean;
  stopped: boolean;
  callback?: (result: { finished: boolean }) => void;
  start(cb?: (result: { finished: boolean }) => void): void;
  stop(): void;
};

export const started: Recorded[] = [];

export class FakeValue {
  value: number;
  private listeners = new Map<string, (state: { value: number }) => void>();
  constructor(value: number) {
    this.value = value;
  }
  setValue(v: number) {
    this.value = v;
    for (const cb of this.listeners.values()) cb({ value: v });
  }
  addListener(cb: (state: { value: number }) => void): string {
    const id = String(this.listeners.size + 1);
    this.listeners.set(id, cb);
    return id;
  }
  removeListener(id: string) {
    this.listeners.delete(id);
  }
  stopAnimation(cb?: (v: number) => void) {
    cb?.(this.value);
  }
  interpolate(config: { inputRange: number[]; outputRange: unknown[] }) {
    return { $$interpolation: config, from: this };
  }
}

function recorded(partial: Partial<Recorded> & Pick<Recorded, "kind">): Recorded {
  const r: Recorded = {
    started: false,
    stopped: false,
    ...partial,
    start(cb) {
      r.started = true;
      r.callback = cb;
      started.push(r);
    },
    stop() {
      r.stopped = true;
    },
  };
  return r;
}

function animated(Component: ComponentType<Record<string, unknown>>) {
  return function AnimatedHost(props: Record<string, unknown>) {
    return createElement(Component, { ...props, animated: true });
  };
}

export const Animated = {
  Value: FakeValue,
  timing: (target: FakeValue, config: Record<string, unknown>) =>
    recorded({ kind: "timing", target, config }),
  sequence: (children: Recorded[]) => recorded({ kind: "sequence", children }),
  loop: (child: Recorded, config: Record<string, unknown>) =>
    recorded({ kind: "loop", children: [child], config }),
  delay: (ms: number) => recorded({ kind: "delay", config: { ms } }),
  // Animated components render the same hosts, flagged with `animated: true` in data-props.
  View: animated(host("rn-view")),
  Text: animated(host("rn-text")),
  Image: animated(host("rn-image")),
  ScrollView: animated(host("rn-scrollview")),
  createAnimatedComponent: (component: ComponentType<Record<string, unknown>>) =>
    animated(component),
};

export const Easing = {
  linear: "linear",
  bezier: (x1: number, y1: number, x2: number, y2: number) => ({ bezier: [x1, y1, x2, y2] }),
};

export function resetFakeAnimated(): void {
  started.length = 0;
}
