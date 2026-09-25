import { transformAsync } from "@babel/core";
import stylexBabelPlugin from "@stylexjs/babel-plugin";
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
          [
            stylexBabelPlugin,
            {
              dev: true,
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
