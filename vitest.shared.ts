import { transformAsync } from "@babel/core";
import stylexBabelPlugin from "@stylexjs/babel-plugin";
import stylexnBabelPlugin from "./packages/stylexn/src/babel/plugin.ts";
import type { Plugin } from "vite";

const monorepoRoot = import.meta.dirname;

// Runs the StyleX compiler over test modules so unit tests see the same
// compiled output (class names, injected CSS) the web build produces,
// rather than StyleX's uncompiled runtime fallback. Mirrors the options in
// apps/web/babel.config.js.
export function stylexTestPlugin(): Plugin {
  return {
    name: "stylexn:stylex-test-transform",
    enforce: "pre",
    async transform(code, id) {
      if (!/\.[cm]?[jt]sx?$/.test(id) || id.includes("/node_modules/")) return null;
      if (!code.includes("stylex")) return null;
      const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [
          // Inline web({ }) / drop native({ }) so StyleX sees plain literals.
          [stylexnBabelPlugin, { platform: "web" }],
          [
            stylexBabelPlugin,
            {
              dev: true,
              importSources: ["@stylexjs/stylex", "stylexn"],
              runtimeInjection: true,
              unstable_moduleResolution: { type: "commonJS", rootDir: monorepoRoot },
            },
          ],
        ],
      });
      if (!result?.code) return null;
      return { code: result.code, map: result.map ?? null };
    },
  };
}

/**
 * The native counterpart: runs `stylexn/babel` in native mode over test
 * modules (rules compile to the runtime shape, defineVars get stable ids,
 * keyframes compile), as Metro does for the mobile app.
 */
export function stylexnNativeTestPlugin(): Plugin {
  return {
    name: "stylexn:native-test-transform",
    enforce: "pre",
    async transform(code, id) {
      if (!/\.[cm]?[jt]sx?$/.test(id) || id.includes("/node_modules/")) return null;
      if (!code.includes("stylex")) return null;
      const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [[stylexnBabelPlugin, { platform: "native", rootDir: monorepoRoot }]],
      });
      if (!result?.code) return null;
      return { code: result.code, map: result.map ?? null };
    },
  };
}
