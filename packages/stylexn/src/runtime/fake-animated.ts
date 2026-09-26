/**
 * Test double for React Native's Animated: records what the runtime builds
 * (values, interpolations, timings, loops) without running any timers.
 */
import { createElement, type ReactNode } from "react";

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
  constructor(value: number) {
    this.value = value;
  }
  setValue(v: number) {
    this.value = v;
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

const host =
  (tag: string) =>
  ({ style, children, testID }: { style: unknown; children?: ReactNode; testID?: string }) =>
    createElement(tag, { "data-testid": testID, "data-style": JSON.stringify(style) }, children);

export const Animated = {
  Value: FakeValue,
  timing: (target: FakeValue, config: Record<string, unknown>) =>
    recorded({ kind: "timing", target, config }),
  sequence: (children: Recorded[]) => recorded({ kind: "sequence", children }),
  loop: (child: Recorded, config: Record<string, unknown>) =>
    recorded({ kind: "loop", children: [child], config }),
  delay: (ms: number) => recorded({ kind: "delay", config: { ms } }),
  View: host("animated-view"),
  Text: host("animated-text"),
  createAnimatedComponent: () => host("animated-pressable"),
};

export const Easing = {
  linear: "linear",
  bezier: (x1: number, y1: number, x2: number, y2: number) => ({ bezier: [x1, y1, x2, y2] }),
};

export function resetFakeAnimated(): void {
  started.length = 0;
}
