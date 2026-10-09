import { describe, expect, test } from "vitest";
import { matchesMedia } from "./media.ts";
import type { Env } from "./types.ts";

const env = (overrides: Partial<Env> = {}): Env => ({
  window: { width: 390, height: 844, scale: 3, fontScale: 1 },
  colorScheme: "light",
  reducedMotion: false,
  contrast: "no-preference",
  reducedTransparency: false,
  invertedColors: false,
  pointer: "coarse",
  interaction: {},
  vars: {},
  rootFontSize: 16,
  fontSize: 14,
  platform: "ios",
  ...overrides,
});

describe("matchesMedia", () => {
  test("min/max width and height", () => {
    expect(matchesMedia("@media (min-width: 320px)", env())).toBe(true);
    expect(matchesMedia("@media (min-width: 800px)", env())).toBe(false);
    expect(matchesMedia("@media (max-width: 400px)", env())).toBe(true);
    expect(matchesMedia("@media (max-height: 800px)", env())).toBe(false);
    expect(matchesMedia("@media (min-width: 20em)", env())).toBe(true); // 320px
  });

  test("exact, boolean and unknown features", () => {
    expect(matchesMedia("@media (width: 390px)", env())).toBe(true);
    expect(matchesMedia("@media (width)", env())).toBe(true);
    expect(matchesMedia("@media (grid)", env())).toBe(false);
    expect(matchesMedia("@media (forced-colors: active)", env())).toBe(false);
  });

  test("range syntax", () => {
    expect(matchesMedia("@media (width >= 390px)", env())).toBe(true);
    expect(matchesMedia("@media (width > 390px)", env())).toBe(false);
    expect(matchesMedia("@media (300px <= width <= 400px)", env())).toBe(true);
    expect(matchesMedia("@media (400px < width < 800px)", env())).toBe(false);
    expect(matchesMedia("@media (800px > width)", env())).toBe(true);
  });

  test("orientation and aspect ratio", () => {
    expect(matchesMedia("@media (orientation: portrait)", env())).toBe(true);
    expect(matchesMedia("@media (orientation: landscape)", env())).toBe(false);
    expect(matchesMedia("@media (min-aspect-ratio: 16/9)", env())).toBe(false);
    expect(matchesMedia("@media (max-aspect-ratio: 1/1)", env())).toBe(true);
  });

  test("resolution", () => {
    expect(matchesMedia("@media (min-resolution: 2dppx)", env())).toBe(true);
    expect(matchesMedia("@media (min-resolution: 192dpi)", env())).toBe(true);
    expect(matchesMedia("@media (resolution: 2x)", env())).toBe(false);
  });

  test("preferences", () => {
    expect(matchesMedia("@media (prefers-color-scheme: dark)", env())).toBe(false);
    expect(matchesMedia("@media (prefers-color-scheme: dark)", env({ colorScheme: "dark" }))).toBe(
      true,
    );
    expect(matchesMedia("@media (prefers-reduced-motion: reduce)", env())).toBe(false);
    expect(
      matchesMedia("@media (prefers-reduced-motion: reduce)", env({ reducedMotion: true })),
    ).toBe(true);
    expect(matchesMedia("@media (prefers-reduced-motion: no-preference)", env())).toBe(true);
  });

  test("prefers-contrast: only more and no-preference are detectable", () => {
    const more = env({ contrast: "more" });
    expect(matchesMedia("@media (prefers-contrast: more)", env())).toBe(false);
    expect(matchesMedia("@media (prefers-contrast: more)", more)).toBe(true);
    expect(matchesMedia("@media (prefers-contrast: no-preference)", env())).toBe(true);
    expect(matchesMedia("@media (prefers-contrast: no-preference)", more)).toBe(false);
    expect(matchesMedia("@media (prefers-contrast)", env())).toBe(false);
    expect(matchesMedia("@media (prefers-contrast)", more)).toBe(true);
    for (const value of ["less", "custom"]) {
      expect(matchesMedia(`@media (prefers-contrast: ${value})`, env()), value).toBe(false);
      expect(matchesMedia(`@media (prefers-contrast: ${value})`, more), value).toBe(false);
    }
  });

  test("prefers-reduced-transparency", () => {
    const reduce = env({ reducedTransparency: true });
    expect(matchesMedia("@media (prefers-reduced-transparency: reduce)", env())).toBe(false);
    expect(matchesMedia("@media (prefers-reduced-transparency: reduce)", reduce)).toBe(true);
    expect(matchesMedia("@media (prefers-reduced-transparency: no-preference)", env())).toBe(true);
    expect(matchesMedia("@media (prefers-reduced-transparency: no-preference)", reduce)).toBe(
      false,
    );
    expect(matchesMedia("@media (prefers-reduced-transparency)", env())).toBe(false);
    expect(matchesMedia("@media (prefers-reduced-transparency)", reduce)).toBe(true);
  });

  test("inverted-colors", () => {
    const inverted = env({ invertedColors: true });
    expect(matchesMedia("@media (inverted-colors: inverted)", env())).toBe(false);
    expect(matchesMedia("@media (inverted-colors: inverted)", inverted)).toBe(true);
    expect(matchesMedia("@media (inverted-colors: none)", env())).toBe(true);
    expect(matchesMedia("@media (inverted-colors: none)", inverted)).toBe(false);
    expect(matchesMedia("@media (inverted-colors)", env())).toBe(false);
    expect(matchesMedia("@media (inverted-colors)", inverted)).toBe(true);
    expect(matchesMedia("@media not all and (inverted-colors)", inverted)).toBe(false);
  });

  test("hover and pointer", () => {
    expect(matchesMedia("@media (hover: hover)", env())).toBe(false);
    expect(matchesMedia("@media (hover: none)", env())).toBe(true);
    expect(matchesMedia("@media (hover: hover)", env({ pointer: "fine" }))).toBe(true);
    expect(matchesMedia("@media (pointer: coarse)", env())).toBe(true);
    expect(matchesMedia("@media (any-pointer)", env({ pointer: "none" }))).toBe(false);
  });

  test("logic: and, not, only, commas, media types", () => {
    expect(matchesMedia("@media (min-width: 300px) and (max-width: 400px)", env())).toBe(true);
    expect(matchesMedia("@media (min-width: 300px) and (max-width: 350px)", env())).toBe(false);
    expect(matchesMedia("@media not all and (min-width: 800px)", env())).toBe(true);
    expect(matchesMedia("@media only screen and (min-width: 300px)", env())).toBe(true);
    expect(matchesMedia("@media (min-width: 800px), (orientation: portrait)", env())).toBe(true);
    expect(matchesMedia("@media print", env())).toBe(false);
    expect(matchesMedia("@media screen", env())).toBe(true);
    expect(matchesMedia("@media", env())).toBe(true);
  });
});
