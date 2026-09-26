/**
 * Integration test: run the real oxlint binary with the plugin loaded through
 * `jsPlugins` on a fixture, and read its JSON output. This is the alpha API
 * the handoff asked us to verify.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

const plugin = path.resolve(import.meta.dirname, "eslint-plugin.ts");
const oxlint = path.resolve(import.meta.dirname, "../../../../node_modules/.bin/oxlint");

type Diagnostic = {
  code: string;
  message: string;
  severity: string;
  labels?: { span: { line: number } }[];
};

function lint(source: string, options: Record<string, unknown> = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "stylexn-oxlint-"));
  writeFileSync(path.join(dir, "fixture.tsx"), source);
  writeFileSync(
    path.join(dir, ".oxlintrc.json"),
    JSON.stringify({
      jsPlugins: [plugin],
      rules: { "stylexn/compat": ["error", options] },
    }),
  );
  let out: string;
  try {
    out = execFileSync(oxlint, ["--format", "json", "-c", ".oxlintrc.json", "fixture.tsx"], {
      cwd: dir,
      encoding: "utf8",
    });
  } catch (error) {
    out = (error as { stdout: string }).stdout;
  }
  const parsed = JSON.parse(out) as { diagnostics: Diagnostic[] };
  return parsed.diagnostics
    .filter((d) => d.code === "stylexn(compat)")
    .map((d) => ({ message: d.message, line: d.labels?.[0]?.span.line }));
}

describe("oxlint jsPlugins integration", () => {
  test("reports unsupported styles at their source", () => {
    const diagnostics = lint(`import * as stylex from "stylexn";
const dark = "@media (prefers-color-scheme: dark)";
export const styles = stylex.create({
  card: {
    color: "red",
    float: "left",
    display: { default: "flex", [dark]: "grid" },
    margin: "1ch",
  },
});`);
    expect(diagnostics.map((d) => d.line)).toEqual([6, 7, 8]);
    expect(diagnostics[0]?.message).toMatch(/float/);
    expect(diagnostics[1]?.message).toMatch(/grid.*\(warning\)/);
    expect(diagnostics[2]?.message).toMatch(/unit "ch"/);
  });

  test("clean files produce nothing", () => {
    expect(
      lint(
        `import * as stylex from "stylexn";\nexport const s = stylex.create({ a: { color: "red" } });`,
      ),
    ).toEqual([]);
  });

  test("rule options", () => {
    const src = `import * as stylex from "stylexn";\nexport const s = stylex.create({ a: { willChange: "x", boxShadow: "0 1px red" } });`;
    expect(lint(src)).toEqual([]);
    const strict = lint(src, { reportWebOnly: true, rnVersion: "0.75" });
    expect(strict.map((d) => d.message)).toEqual([
      expect.stringMatching(/willChange.*\(warning\)/),
      expect.stringMatching(/boxShadow needs React Native 0\.76/),
    ]);
  });
});
