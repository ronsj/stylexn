// Bundles the entries that run in plain Node/Babel (no TypeScript loader
// guaranteed): the Babel plugin as CJS (Babel loads plugins synchronously),
// the rest as ESM. Runtime, elements and the web entry stay as .ts source;
// consumers' bundlers transpile those.
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
