import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { detectRNVersion, detectRNVersionFor } from "./rn-version.ts";

/** A project directory whose node_modules holds a fake react-native of `version`. */
function project(version: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "stylexn-rn-"));
  mkdirSync(path.join(dir, "node_modules/react-native"), { recursive: true });
  writeFileSync(
    path.join(dir, "node_modules/react-native/package.json"),
    JSON.stringify({ name: "react-native", version }),
  );
  mkdirSync(path.join(dir, "src/deep"), { recursive: true });
  return dir;
}

describe("detectRNVersion", () => {
  test("reads major.minor from the react-native package resolvable from a directory", () => {
    const dir = project("0.99.4-rc.1");
    expect(detectRNVersion(dir)).toBe("0.99");
    expect(detectRNVersion(path.join(dir, "src/deep"))).toBe("0.99"); // walks up like require
    // packages/stylexn lists the real react-native as a devDependency.
    expect(detectRNVersion(import.meta.dirname)).toMatch(/^\d+\.\d+$/);
  });

  test("detectRNVersionFor prefers the file's own project over the working directory", () => {
    const a = project("0.77.0");
    const b = project("0.80.2");
    expect(detectRNVersionFor(path.join(a, "src/deep/x.ts"), b)).toBe("0.77");
    expect(detectRNVersionFor(undefined, b)).toBe("0.80");
  });
});
