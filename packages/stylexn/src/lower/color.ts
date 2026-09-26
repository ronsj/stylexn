/**
 * Compile-time color conversion. React Native parses hex, rgb()/rgba(),
 * hsl()/hsla(), hwb() and named colors; the CIE and OK spaces, `color()`
 * and `color-mix()` are converted here to rgb()/rgba() (sRGB, clipped to
 * gamut, no gamut mapping).
 */
import { splitComma, splitSpace } from "../expand/tokenize.ts";

export type RGBA = Readonly<{ r: number; g: number; b: number; a: number }>; // sRGB 0..1

const CONVERTED = /^(lab|lch|oklab|oklch|color|color-mix)\(/i;

export const isConvertedColorFunction = (token: string): boolean => CONVERTED.test(token.trim());

// ---------------------------------------------------------------------------
// Color space math
// ---------------------------------------------------------------------------

type V3 = [number, number, number];
type M3 = [V3, V3, V3];

const mul = (m: M3, v: V3): V3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

const gamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const OKLAB_TO_LMS: M3 = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];
const LMS_TO_LINEAR_SRGB: M3 = [
  [4.0767416621, -3.3077115913, 0.2307590544],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];
const LINEAR_SRGB_TO_LMS: M3 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS_TO_OKLAB: M3 = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const XYZ_D50_TO_D65: M3 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];
const XYZ_D65_TO_LINEAR_SRGB: M3 = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const LINEAR_P3_TO_XYZ_D65: M3 = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
const D50: V3 = [0.9642956764, 1, 0.8251046025];

const oklabToLinear = (lab: V3): V3 => {
  const lms = mul(OKLAB_TO_LMS, lab).map((c) => c ** 3) as V3;
  return mul(LMS_TO_LINEAR_SRGB, lms);
};
const linearToOklab = (rgb: V3): V3 => {
  const lms = mul(LINEAR_SRGB_TO_LMS, rgb).map(Math.cbrt) as V3;
  return mul(LMS_TO_OKLAB, lms);
};
const labToLinear = ([L, a, b]: V3): V3 => {
  const e = 216 / 24389;
  const k = 24389 / 27;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xr = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const yr = L > k * e ? fy ** 3 : L / k;
  const zr = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  const xyz50: V3 = [xr * D50[0], yr * D50[1], zr * D50[2]];
  return mul(XYZ_D65_TO_LINEAR_SRGB, mul(XYZ_D50_TO_D65, xyz50));
};
const polarToRect = ([L, C, H]: V3): V3 => {
  const h = (H * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
};
const rectToPolar = ([L, a, b]: V3): V3 => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
};

const fromLinear = (rgb: V3, a: number): RGBA => ({
  r: gamma(rgb[0]),
  g: gamma(rgb[1]),
  b: gamma(rgb[2]),
  a,
});
const toLinear = (c: RGBA): V3 => [linear(c.r), linear(c.g), linear(c.b)];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

class ColorError extends Error {}

/** Number or percentage; `none` is 0. `scale` is what 100% maps to. */
function component(token: string, scale: number): number {
  const t = token.trim().toLowerCase();
  if (t === "none") return 0;
  if (t.endsWith("%")) {
    const n = Number(t.slice(0, -1));
    if (Number.isNaN(n)) throw new ColorError(`bad percentage "${token}"`);
    return (n / 100) * scale;
  }
  const n = Number(t.replace(/deg$/, ""));
  if (Number.isNaN(n)) throw new ColorError(`bad number "${token}"`);
  return n;
}

/** Split `a b c / alpha` (modern) or `a, b, c, alpha` (legacy) arguments. */
function args(inner: string): { parts: string[]; alpha: number } {
  let alpha = 1;
  let body = inner;
  const slash = inner.indexOf("/");
  if (slash !== -1) {
    alpha = component(inner.slice(slash + 1), 1);
    body = inner.slice(0, slash);
  }
  let parts = body.includes(",") ? splitComma(body) : splitSpace(body);
  if (slash === -1 && body.includes(",") && parts.length === 4) {
    alpha = component(parts[3] as string, 1);
    parts = parts.slice(0, 3);
  }
  return { parts: parts.map((p) => p.trim()), alpha };
}

function hslToRgb(h: number, s: number, l: number): V3 {
  const hue = (((h % 360) + 360) % 360) / 30;
  const f = (n: number) => {
    const k = (n + hue) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** Parse any color StyleXN understands into sRGB; null for unknown syntax (named colors, etc.). */
export function parseColor(token: string): RGBA | null {
  const t = token.trim();
  const hex = t.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const short = hex.length <= 4;
    const digits = short ? [...hex].map((c) => c + c) : (hex.match(/../g) as string[]);
    if (![3, 4].includes(digits.length)) return null;
    const [r, g, b, a = "ff"] = digits.map((d) => parseInt(d, 16)) as [
      number,
      number,
      number,
      number?,
    ];
    return { r: r / 255, g: g / 255, b: b / 255, a: (typeof a === "number" ? a : 255) / 255 };
  }
  if (t.toLowerCase() === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const m = t.match(/^([a-z-]+)\((.*)\)$/is);
  if (!m) return null;
  const name = (m[1] as string).toLowerCase();
  const { parts, alpha } = args(m[2] as string);
  const need = (n: number) => {
    if (parts.length !== n) throw new ColorError(`${name}() expects ${n} components`);
  };
  switch (name) {
    case "rgb":
    case "rgba": {
      need(3);
      const [r, g, b] = parts.map((p) => component(p, 255) / 255) as V3;
      return { r, g, b, a: alpha };
    }
    case "hsl":
    case "hsla": {
      need(3);
      const [h, s, l] = [
        component(parts[0] as string, 360),
        component(parts[1] as string, 1),
        component(parts[2] as string, 1),
      ];
      const [r, g, b] = hslToRgb(h, s, l);
      return { r, g, b, a: alpha };
    }
    case "hwb": {
      need(3);
      const h = component(parts[0] as string, 360);
      let w = component(parts[1] as string, 1);
      let bl = component(parts[2] as string, 1);
      if (w + bl > 1) {
        const sum = w + bl;
        w /= sum;
        bl /= sum;
      }
      const [r, g, b] = hslToRgb(h, 1, 0.5).map((c) => c * (1 - w - bl) + w) as V3;
      return { r, g, b, a: alpha };
    }
    case "oklab": {
      need(3);
      const lab: V3 = [
        component(parts[0] as string, 1),
        component(parts[1] as string, 0.4),
        component(parts[2] as string, 0.4),
      ];
      return fromLinear(oklabToLinear(lab), alpha);
    }
    case "oklch": {
      need(3);
      const lch: V3 = [
        component(parts[0] as string, 1),
        component(parts[1] as string, 0.4),
        component(parts[2] as string, 360),
      ];
      return fromLinear(oklabToLinear(polarToRect(lch)), alpha);
    }
    case "lab": {
      need(3);
      const lab: V3 = [
        component(parts[0] as string, 100),
        component(parts[1] as string, 125),
        component(parts[2] as string, 125),
      ];
      return fromLinear(labToLinear(lab), alpha);
    }
    case "lch": {
      need(3);
      const lch: V3 = [
        component(parts[0] as string, 100),
        component(parts[1] as string, 150),
        component(parts[2] as string, 360),
      ];
      return fromLinear(labToLinear(polarToRect(lch)), alpha);
    }
    case "color": {
      const space = (parts[0] ?? "").toLowerCase();
      const c = parts.slice(1).map((p) => component(p, 1));
      if (c.length !== 3) throw new ColorError("color() expects a space and three components");
      const v = c as V3;
      if (space === "srgb") return { r: v[0], g: v[1], b: v[2], a: alpha };
      if (space === "srgb-linear") return fromLinear(v, alpha);
      if (space === "display-p3") {
        const xyz = mul(LINEAR_P3_TO_XYZ_D65, v.map(linear) as V3);
        return fromLinear(mul(XYZ_D65_TO_LINEAR_SRGB, xyz), alpha);
      }
      throw new ColorError(`color(): unsupported space "${space}"`);
    }
    case "color-mix":
      return colorMix(m[2] as string);
    default:
      return null;
  }
}

/** `in <space>, <color> [<p>%], <color> [<p>%]` */
function colorMix(body: string): RGBA {
  const items = splitComma(body).map((s) => s.trim());
  const spaceMatch = items[0]?.match(
    /^in\s+([a-z-]+)(?:\s+(shorter|longer|increasing|decreasing)\s+hue)?$/i,
  );
  if (!spaceMatch || items.length !== 3)
    throw new ColorError("color-mix() expects `in <space>, <color>, <color>`");
  const space = (spaceMatch[1] as string).toLowerCase();
  const parseItem = (item: string): { color: RGBA; p: number | null } => {
    const tokens = splitSpace(item);
    let p: number | null = null;
    const colorTokens = tokens.filter((t) => {
      if (/^\d*\.?\d+%$/.test(t)) {
        p = Number(t.slice(0, -1)) / 100;
        return false;
      }
      return true;
    });
    const color = parseColor(colorTokens.join(" "));
    if (!color)
      throw new ColorError(
        `color-mix(): cannot convert "${colorTokens.join(" ")}" at compile time`,
      );
    return { color, p };
  };
  const a = parseItem(items[1] as string);
  const b = parseItem(items[2] as string);
  let p1 = a.p;
  let p2 = b.p;
  if (p1 === null && p2 === null) p1 = p2 = 0.5;
  else if (p1 === null) p1 = 1 - (p2 as number);
  else if (p2 === null) p2 = 1 - p1;
  const sum = (p1 as number) + (p2 as number);
  if (sum === 0) throw new ColorError("color-mix(): percentages sum to zero");
  const w1 = (p1 as number) / sum;
  const w2 = (p2 as number) / sum;
  const alphaMultiplier = sum < 1 ? sum : 1;

  const mixV = (x: V3, y: V3): V3 => [
    x[0] * w1 + y[0] * w2,
    x[1] * w1 + y[1] * w2,
    x[2] * w1 + y[2] * w2,
  ];
  const mixHue = (h1: number, h2: number): number => {
    let d = h2 - h1;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return h1 + d * w2;
  };
  const alpha = (a.color.a * w1 + b.color.a * w2) * alphaMultiplier;
  switch (space) {
    case "srgb":
      return {
        ...rgbOf(mixV([a.color.r, a.color.g, a.color.b], [b.color.r, b.color.g, b.color.b])),
        a: alpha,
      };
    case "srgb-linear":
      return fromLinear(mixV(toLinear(a.color), toLinear(b.color)), alpha);
    case "oklab":
      return fromLinear(
        oklabToLinear(mixV(linearToOklab(toLinear(a.color)), linearToOklab(toLinear(b.color)))),
        alpha,
      );
    case "oklch": {
      const p = rectToPolar(linearToOklab(toLinear(a.color)));
      const q = rectToPolar(linearToOklab(toLinear(b.color)));
      const mixed: V3 = [p[0] * w1 + q[0] * w2, p[1] * w1 + q[1] * w2, mixHue(p[2], q[2])];
      return fromLinear(oklabToLinear(polarToRect(mixed)), alpha);
    }
    default:
      throw new ColorError(`color-mix(): unsupported space "${space}"`);
  }
}

const rgbOf = (v: V3): Omit<RGBA, "a"> => ({ r: v[0], g: v[1], b: v[2] });

const to255 = (c: number): number => Math.round(Math.min(1, Math.max(0, c)) * 255);

/** `rgb(r, g, b)` / `rgba(r, g, b, a)`. */
export function formatRGB(c: RGBA): string {
  const rgb = `${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}`;
  const a = Math.min(1, Math.max(0, c.a));
  return a < 1 ? `rgba(${rgb}, ${Math.round(a * 1000) / 1000})` : `rgb(${rgb})`;
}

export type ColorResult = Readonly<{ ok: true; value: string } | { ok: false; reason: string }>;

/** Convert a color-function token React Native cannot parse; `null` when the token is not one. */
export function convertColor(token: string): ColorResult | null {
  if (!isConvertedColorFunction(token)) return null;
  try {
    const parsed = parseColor(token);
    if (!parsed) return { ok: false, reason: `${token}: unknown color syntax` };
    return { ok: true, value: formatRGB(parsed) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof ColorError ? error.message : `${token}: ${String(error)}`,
    };
  }
}
