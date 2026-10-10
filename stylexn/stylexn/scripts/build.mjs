// Two kinds of output in dist/:
//
// 1. Bundles for the entries that run in plain Node/Babel (no TypeScript
//    loader guaranteed): the Babel plugin as CJS (Babel loads plugins
//    synchronously), the compiler, ESLint plugin, CLI and bin as ESM.
// 2. Per-file ESM + .d.ts for everything a consumer's bundler imports
//    (runtime, elements, web entry, testing mock), emitted by tsc so the
//    module graph is preserved: the app's defineVars and the elements must
//    share one runtime instance, which a bundle per entry would break.
//    The web elements are then compiled with StyleX and their CSS written
//    to dist/elements.css, so consumers do not have to run the StyleX
//    plugin over node_modules.
//
// In this repo the package's `exports` point at src; `publishConfig.exports`
// swaps them for these files when the package is packed or published.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { transformSync } from "@babel/core";
import stylexBabelPlugin from "@stylexjs/babel-plugin";
import { build } from "esbuild";

const external = ["@babel/core", "@stylexjs/*", "react", "react-native"];

await build({
  entryPoints: { babel: "src/babel/index.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  external,
  logLevel: "warning",
});

await build({
  entryPoints: {
    compiler: "src/compiler.ts",
    "eslint-plugin": "src/lint/eslint-plugin.ts",
    check: "src/cli/check.ts",
    bin: "src/cli/bin.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  external,
  logLevel: "warning",
});

// Per-file ESM and declarations.
const tsc = spawnSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

// StyleX-compile the web elements and emit their stylesheet.
const webElements = "dist/elements/web.js";
const result = transformSync(readFileSync(webElements, "utf8"), {
  filename: webElements,
  babelrc: false,
  configFile: false,
  plugins: [
    [
      stylexBabelPlugin,
      {
        dev: false,
        runtimeInjection: false,
        treeshakeCompensation: true,
        unstable_moduleResolution: { type: "commonJS", rootDir: process.cwd() },
      },
    ],
  ],
});
if (!result?.code) throw new Error("StyleX did not compile dist/elements/web.js");
writeFileSync(webElements, result.code);
const rules = result.metadata?.stylex ?? [];
writeFileSync("dist/elements.css", `${stylexBabelPlugin.processStylexRules(rules, true)}\n`);
console.log(`stylexn: built dist (${rules.length} StyleX rules in elements.css)`);
