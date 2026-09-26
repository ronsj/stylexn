/**
 * Compiled output per React Native version. Guards the `since` gating in the
 * compat table: a fixture with version-dependent properties is compiled for
 * several targets and the result is snapshotted, so a table change that
 * moves a property between versions shows up as a diff here.
 */
import { describe, expect, test } from "vitest";
import type { RNVersion } from "../compat/types.ts";
import { compileRule } from "./compile.ts";

const fixture = {
  padding: 8,
  mixBlendMode: "multiply",
  isolation: "isolate",
  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
  filter: "blur(2px)",
  display: { default: "flex", "@media (min-width: 800px)": "none" },
} as const;

const VERSIONS: readonly RNVersion[] = ["0.74", "0.76", "0.86"];

describe("compiled output per React Native version", () => {
  for (const rnVersion of VERSIONS) {
    test(`React Native ${rnVersion}`, () => {
      const { rule, findings } = compileRule(fixture, { rnVersion });
      expect({
        static: rule.static,
        conditional: rule.conditional,
        stripped: findings.filter((f) => f.kind === "version").map((f) => f.property),
      }).toMatchSnapshot();
    });
  }
});
