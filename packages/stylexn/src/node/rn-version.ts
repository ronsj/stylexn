/**
 * Detect the React Native version a project targets, so `since` gating in
 * the compat table tracks the installed Expo SDK without configuration.
 * Node-only (used by the Babel plugin, the lint rule and the CLI); the
 * runtime never imports this.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { RNVersion } from "../compat/types.ts";

const cache = new Map<string, RNVersion | null>();

/** "major.minor" of the `react-native` package resolvable from `dir`, or undefined. */
export function detectRNVersion(dir: string): RNVersion | undefined {
  const cached = cache.get(dir);
  if (cached !== undefined) return cached ?? undefined;
  let found: RNVersion | null = null;
  try {
    const require = createRequire(join(dir, "noop.js"));
    const pkg = require("react-native/package.json") as { version?: string };
    const m = pkg.version?.match(/^(\d+)\.(\d+)/);
    if (m) found = `${Number(m[1])}.${Number(m[2])}` as RNVersion;
  } catch {
    found = null;
  }
  cache.set(dir, found);
  return found ?? undefined;
}

/** First version found from the file's directory, then the working directory. */
export function detectRNVersionFor(
  filename: string | undefined,
  cwd: string,
): RNVersion | undefined {
  return (filename ? detectRNVersion(dirname(filename)) : undefined) ?? detectRNVersion(cwd);
}
