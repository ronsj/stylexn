import { describe, expect, test } from "vitest";
import { convertColor, formatRGB, parseColor } from "./color.ts";

const convert = (token: string) => {
  const r = convertColor(token);
  return r === null ? null : r.ok ? r.value : `error: ${r.reason}`;
};

describe("parseColor", () => {
  test("hex, rgb, hsl, hwb", () => {
    expect(formatRGB(parseColor("#f00")!)).toBe("rgb(255, 0, 0)");
    expect(formatRGB(parseColor("#00ff0080")!)).toBe("rgba(0, 255, 0, 0.502)");
    expect(formatRGB(parseColor("rgb(10, 20, 30)")!)).toBe("rgb(10, 20, 30)");
    expect(formatRGB(parseColor("rgba(10, 20, 30, 0.5)")!)).toBe("rgba(10, 20, 30, 0.5)");
    expect(formatRGB(parseColor("rgb(100% 0% 0% / 50%)")!)).toBe("rgba(255, 0, 0, 0.5)");
    expect(formatRGB(parseColor("hsl(120, 100%, 50%)")!)).toBe("rgb(0, 255, 0)");
    expect(formatRGB(parseColor("hwb(0 0% 0%)")!)).toBe("rgb(255, 0, 0)");
    expect(formatRGB(parseColor("rebeccapurple")!)).toBe("rgb(102, 51, 153)");
    expect(parseColor("notacolor")).toBeNull();
  });
});

describe("convertColor", () => {
  test("OK and CIE spaces land on sRGB", () => {
    expect(convert("oklab(1 0 0)")).toBe("rgb(255, 255, 255)");
    expect(convert("oklch(0 0 0)")).toBe("rgb(0, 0, 0)");
    expect(convert("oklch(62.8% 0.2577 29.23)")).toBe("rgb(255, 0, 0)");
    expect(convert("lab(100 0 0)")).toBe("rgb(255, 255, 255)");
    expect(convert("lab(54.29 80.8 69.89)")).toBe("rgb(255, 0, 0)"); // CSS Color 4 example for red
    expect(convert("lch(54.29 106.84 40.86)")).toBe("rgb(255, 0, 0)");
    expect(convert("oklch(70% 0.1 200 / 0.5)")).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
    expect(convert("color(srgb 1 0 0)")).toBe("rgb(255, 0, 0)");
    expect(convert("color(srgb-linear 0.5 0.5 0.5)")).toBe("rgb(188, 188, 188)");
    expect(convert("color(display-p3 1 0 0)")).toBe("rgb(255, 0, 0)"); // clipped to sRGB gamut
  });

  test("color-mix", () => {
    expect(convert("color-mix(in srgb, #f00 50%, #00f)")).toBe("rgb(128, 0, 128)");
    expect(convert("color-mix(in srgb, #f00, #00f 25%)")).toBe("rgb(191, 0, 64)");
    expect(convert("color-mix(in oklab, #fff, #000)")).toBe("rgb(99, 99, 99)");
    expect(convert("color-mix(in oklch, oklch(0.7 0.15 30), oklch(0.7 0.15 330))")).toBe(
      convert("oklch(0.7 0.15 0)"),
    );
    expect(convert("color-mix(in srgb, red, blue)")).toBe("rgb(128, 0, 128)");
    expect(convert("color-mix(in srgb, nope, blue)")).toMatch(/cannot convert "nope"/);
    expect(convert("color-mix(in hsl, #f00, #00f)")).toMatch(/unsupported space/);
  });

  test("not a converted function / malformed", () => {
    expect(convert("rgb(1, 2, 3)")).toBeNull();
    expect(convert("oklab(1 0)")).toMatch(/expects 3 components/);
    expect(convert("color(rec2020 1 0 0)")).toMatch(/unsupported space/);
  });
});
