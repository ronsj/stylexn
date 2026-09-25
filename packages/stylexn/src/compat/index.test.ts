import { describe, expect, test } from "vitest";
import {
  compareVersions,
  isAvailable,
  lookupApi,
  lookupAtRule,
  lookupFunction,
  lookupMediaFeature,
  lookupProperty,
  lookupPseudoClass,
  lookupPseudoElement,
  lookupUnit,
  RN_TARGET,
  UNKNOWN,
  worstStatus,
} from "./index.ts";

describe("lookups", () => {
  test("known property", () => {
    expect(lookupProperty("backgroundColor").status).toBe("supported");
  });

  test("unknown property is unsupported, not a crash", () => {
    expect(lookupProperty("scrollbarWidthPx")).toBe(UNKNOWN);
    expect(lookupProperty("")).toBe(UNKNOWN);
  });

  test("custom properties match the --* entry", () => {
    expect(lookupProperty("--brand-color").status).toBe("polyfilled");
  });

  test("pseudo-class arguments are ignored", () => {
    expect(lookupPseudoClass(":nth-child(2n+1)").status).toBe("unsupported");
    expect(lookupPseudoClass(":hover").status).toBe("polyfilled");
    expect(lookupPseudoClass(":made-up")).toBe(UNKNOWN);
  });

  test("pseudo-elements", () => {
    expect(lookupPseudoElement("::placeholder").prop).toBe("placeholderTextColor");
    expect(lookupPseudoElement("::before").status).toBe("unsupported");
  });

  test("at-rules are matched by name, ignoring the query", () => {
    expect(lookupAtRule("@media (min-width: 800px)").status).toBe("partial");
    expect(lookupAtRule("@container (min-width: 400px)").status).toBe("unsupported");
    expect(lookupAtRule("@supports (display: grid)").status).toBe("web-only");
    expect(lookupAtRule("not an at-rule")).toBe(UNKNOWN);
  });

  test("media features", () => {
    expect(lookupMediaFeature("prefers-color-scheme").status).toBe("polyfilled");
    expect(lookupMediaFeature("print").status).toBe("web-only");
  });

  test("units", () => {
    expect(lookupUnit("px").status).toBe("supported");
    expect(lookupUnit("rem").status).toBe("polyfilled");
    expect(lookupUnit("<number>").status).toBe("supported");
    expect(lookupUnit("furlong")).toBe(UNKNOWN);
  });

  test("functions accept names with or without parentheses", () => {
    expect(lookupFunction("var").status).toBe("polyfilled");
    expect(lookupFunction("var()").status).toBe("polyfilled");
    expect(lookupFunction("conic-gradient").status).toBe("unsupported");
  });

  test("apis accept a stylex. prefix", () => {
    expect(lookupApi("stylex.createTheme").status).toBe("polyfilled");
    expect(lookupApi("create").status).toBe("supported");
    expect(lookupApi("nope")).toBe(UNKNOWN);
  });
});

describe("versions", () => {
  test("compareVersions orders major then minor numerically", () => {
    expect(compareVersions("0.86", "0.76")).toBeGreaterThan(0);
    expect(compareVersions("0.9", "0.76")).toBeLessThan(0);
    expect(compareVersions("1.0", "0.99")).toBeGreaterThan(0);
    expect(compareVersions("0.86", "0.86")).toBe(0);
  });

  test("isAvailable respects since and unsupported", () => {
    expect(isAvailable({ status: "supported" })).toBe(true);
    expect(isAvailable({ status: "supported", since: "0.76" }, "0.75")).toBe(false);
    expect(isAvailable({ status: "supported", since: "0.76" }, "0.76")).toBe(true);
    expect(isAvailable({ status: "unsupported", note: "x" })).toBe(false);
    expect(isAvailable(lookupProperty("boxShadow"), RN_TARGET)).toBe(true);
  });
});

describe("worstStatus", () => {
  test("picks by severity", () => {
    expect(worstStatus([])).toBe("supported");
    expect(worstStatus(["supported", "polyfilled"])).toBe("polyfilled");
    expect(worstStatus(["partial", "web-only", "polyfilled"])).toBe("web-only");
    expect(worstStatus(["web-only", "unsupported"])).toBe("unsupported");
  });
});
