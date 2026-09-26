import { afterEach, describe, expect, test } from "vitest";
import { getKeyframes, keyframes, resetKeyframesForTesting } from "./keyframes.ts";

afterEach(resetKeyframesForTesting);

describe("keyframes registry", () => {
  test("frames are compiled and sorted by offset", () => {
    const name = keyframes({ to: { opacity: 1 }, "0%, 50%": { opacity: 0 } });
    expect(getKeyframes(name)?.frames.map((f) => [f.offset, f.rule.static])).toEqual([
      [0, { opacity: 0 }],
      [0.5, { opacity: 0 }],
      [1, { opacity: 1 }],
    ]);
  });

  test("without an id the counter yields unique names", () => {
    const a = keyframes({ to: { opacity: 0 } });
    const b = keyframes({ to: { opacity: 0 } });
    expect(a).not.toBe(b);
    expect(getKeyframes(a)).toBeDefined();
    expect(getKeyframes(b)).toBeDefined();
  });
});

describe("stable ids (Fast Refresh)", () => {
  test("an injected id is the name, and re-registering it swaps the frames", () => {
    const first = keyframes({ to: { opacity: 0 } }, "stylexn-keyframes-abc");
    expect(first).toBe("stylexn-keyframes-abc");
    // The module hot-reloads with edited frames; a rule elsewhere still holds `first`.
    const second = keyframes({ to: { opacity: 0.5 } }, "stylexn-keyframes-abc");
    expect(second).toBe(first);
    expect(getKeyframes(first)?.frames).toEqual([{ offset: 1, rule: expect.anything() }]);
    expect(getKeyframes(first)?.frames[0]?.rule.static).toEqual({ opacity: 0.5 });
  });
});
