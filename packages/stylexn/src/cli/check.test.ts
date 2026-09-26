import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { checkFiles, checkSource, expandPaths, formatProblem } from "./check.ts";

const HEADER = `import * as stylex from "@stylexjs/stylex";\n`;

describe("checkSource", () => {
  test("reports problems with positions", () => {
    const problems = checkSource(
      `${HEADER}const dark = "@media (prefers-color-scheme: dark)";
const styles = stylex.create({
  card: {
    float: "left",
    display: { default: "flex", [dark]: "grid" },
    color: { default: "red", ":first-child": "blue" },
    margin: "1ch",
    willChange: "transform",
  },
  fade: (o) => ({ opacity: o, position: "sticky" }),
});`,
      "card.tsx",
    );
    expect(problems.map(formatProblem)).toEqual([
      "card.tsx:5:5 error: float — React Native has no CSS flow layout; only flexbox.",
      'card.tsx:6:33 warning: display: "grid" is not supported on React Native; accepted: flex, none, contents',
      "card.tsx:7:30 error: :first-child on color — Structural selectors need sibling context React Native does not expose.",
      'card.tsx:8:5 error: marginTop: unit "ch" — Font metrics are not exposed.',
      'card.tsx:11:31 warning: position: "sticky" is not supported on React Native; accepted: relative, absolute, static',
    ]);
  });

  test("ignores other modules and non-literal shapes", () => {
    expect(
      checkSource(`import * as s from "other";\ns.create({ a: { float: "left" } });`, "x.ts"),
    ).toEqual([]);
    expect(checkSource(`${HEADER}const o = {}; stylex.create(o);`, "x.ts")).toEqual([]);
    expect(checkSource(`${HEADER}stylex.create({ a: someRule });`, "x.ts")).toEqual([]);
  });

  test("named imports, stylexn, and shape errors", () => {
    expect(
      checkSource(`import { create } from "stylexn";\ncreate({ a: { float: "left" } });`, "x.ts"),
    ).toHaveLength(1);
    const [p] = checkSource(`${HEADER}stylex.create({ a: { ...spread } });`, "x.ts");
    expect(p?.message).toMatch(/plain properties/);
  });

  test("web-only reporting is opt-in", () => {
    const src = `${HEADER}stylex.create({ a: { willChange: "x" } });`;
    expect(checkSource(src, "x.ts")).toEqual([]);
    expect(checkSource(src, "x.ts", { reportWebOnly: true })).toHaveLength(1);
  });
});

describe("bin", () => {
  const bin = path.resolve(import.meta.dirname, "bin.ts");
  const run = (args: string[]) => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [bin, ...args], { encoding: "utf8" }) };
    } catch (error) {
      const e = error as { status: number; stdout: string; stderr: string };
      return { code: e.status, out: e.stdout + e.stderr };
    }
  };

  test("exit codes and output", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "stylexn-"));
    const bad = path.join(dir, "bad.tsx");
    const warn = path.join(dir, "warn.tsx");
    const ok = path.join(dir, "ok.tsx");
    writeFileSync(bad, `${HEADER}stylex.create({ a: { float: "left" } });`);
    writeFileSync(warn, `${HEADER}stylex.create({ a: { display: "grid" } });`);
    writeFileSync(ok, `${HEADER}stylex.create({ a: { color: "red" } });`);

    expect(run(["check", ok])).toEqual({ code: 0, out: "" });
    const failed = run(["check", bad, warn]);
    expect(failed.code).toBe(1);
    expect(failed.out).toMatch(/bad\.tsx:2:22 error: float/);
    expect(failed.out).toMatch(/1 error\(s\), 1 warning\(s\) in 2 file\(s\)/);
    expect(run(["check", warn]).code).toBe(0);
    expect(run(["check", "--strict", warn]).code).toBe(1);
    expect(run(["check", "--quiet", warn]).out).not.toMatch(/warning:/);
    expect(run([]).code).toBe(1);
    expect(run(["--help"]).out).toMatch(/Usage/);
  });
});

describe("escape hatches and ignores", () => {
  test("web blocks are skipped, native blocks are trusted but not for unsupported properties", () => {
    const problems = checkSource(
      `import * as stylex from "stylexn";
stylex.create({
  a: {
    ...stylex.web({ float: "left", display: "grid" }),
    ...stylex.native({ elevation: 2, margin: "1ch", float: "right" }),
  },
});`,
      "h.tsx",
    );
    expect(problems.map(formatProblem)).toEqual([
      "h.tsx:5:53 error: float — React Native has no CSS flow layout; only flexbox.",
    ]);
  });

  test("// stylexn-ignore silences a declaration", () => {
    const problems = checkSource(
      `${HEADER}stylex.create({
  a: {
    // stylexn-ignore
    float: "left",
    display: "grid", // stylexn-ignore
    position: "sticky",
  },
});`,
      "i.tsx",
    );
    expect(problems.map((p) => p.message)).toEqual([expect.stringMatching(/sticky/)]);
  });
});

describe("expandPaths", () => {
  test("directories are searched recursively, skipping build output", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "stylexn-check-"));
    mkdirSync(path.join(dir, "src/deep"), { recursive: true });
    mkdirSync(path.join(dir, "node_modules/x"), { recursive: true });
    mkdirSync(path.join(dir, "dist"), { recursive: true });
    for (const f of [
      "src/a.tsx",
      "src/deep/b.ts",
      "src/c.md",
      "node_modules/x/d.ts",
      "dist/e.js",
    ]) {
      writeFileSync(path.join(dir, f), "");
    }
    expect(
      expandPaths([dir])
        .map((f) => path.relative(dir, f))
        .toSorted(),
    ).toEqual(["src/a.tsx", "src/deep/b.ts"]);
    expect(expandPaths([path.join(dir, "src/c.md")])).toEqual([path.join(dir, "src/c.md")]);
  });

  test("web-only leakage fails a strict run through checkFiles", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "stylexn-check-"));
    writeFileSync(
      path.join(dir, "leak.tsx"),
      `${HEADER}import { web } from "stylexn";
const s = stylex.create({ a: { willChange: "transform" }, b: { ...web({ willChange: "transform" }) } });`,
    );
    const problems = checkFiles([dir], { reportWebOnly: true });
    expect(problems.map((p) => p.severity)).toEqual(["warning"]); // only the unwrapped one
    expect(problems[0]?.line).toBe(3);
  });
});
