import { describe, expect, test } from "vitest";
import { lintDeclarations } from "./core.ts";
import type { AstNode } from "./extract.ts";

const node = (type: string): AstNode => ({ type });

describe("lintDeclarations", () => {
  test("clean rules produce nothing", () => {
    expect(lintDeclarations({ color: "red", margin: "1px 2px" }, new Map())).toEqual([]);
  });

  test("severity policy", () => {
    const messages = lintDeclarations(
      { float: "left", display: "grid", willChange: "x" },
      new Map(),
    );
    expect(messages.map((m) => `${m.severity}:${m.path}`)).toEqual([
      "error:float",
      "warning:display",
    ]);
    const withWebOnly = lintDeclarations({ willChange: "x" }, new Map(), { reportWebOnly: true });
    expect(withWebOnly).toMatchObject([{ severity: "warning", path: "willChange" }]);
  });

  test("findings on expanded longhands map back to the authored shorthand, once", () => {
    const margin = node("Property");
    const messages = lintDeclarations({ margin: "1ch" }, new Map([["margin", margin]]));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ severity: "error", path: "margin", node: margin });
    expect(messages[0]?.message).toMatch(/unit "ch"/);
  });

  test("conditional findings locate the branch, falling back to the property", () => {
    const branch = node("Property");
    const prop = node("Property");
    const locations = new Map([
      ["color", prop],
      ["color[:first-child]", branch],
    ]);
    const messages = lintDeclarations(
      { color: { default: "red", ":first-child": "blue", ":visited": "x" } },
      locations,
    );
    expect(messages.map((m) => [m.path, m.node])).toEqual([["color[:first-child]", branch]]);
    const nested = lintDeclarations({ width: { "@media (min-width: 1px)": "1ch" } }, locations);
    expect(nested[0]?.path).toBe("width[@media (min-width: 1px)]");
    expect(nested[0]?.node).toBeUndefined();
  });

  test("malformed shorthands are errors at the property", () => {
    const prop = node("Property");
    const messages = lintDeclarations(
      { margin: "1px 2px 3px 4px 5px" },
      new Map([["margin", prop]]),
    );
    expect(messages).toMatchObject([{ severity: "error", path: "margin", node: prop }]);
  });

  test("version gating", () => {
    expect(
      lintDeclarations({ boxShadow: "0 1px 2px red" }, new Map(), { rnVersion: "0.75" }),
    ).toMatchObject([{ severity: "error", path: "boxShadow" }]);
  });
});

describe("trusted declarations", () => {
  test("native blocks exempt unknown keys and value checks, not listed-unsupported properties", () => {
    const messages = lintDeclarations(
      { elevation: 2, margin: "1ch", float: "left", display: "grid" },
      new Map(),
      { trusted: new Set(["elevation", "margin", "float"]) },
    );
    expect(messages.map((m) => m.path)).toEqual(["float", "display"]);
  });
});
