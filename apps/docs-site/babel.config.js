const path = require("node:path");

const dev = process.env.NODE_ENV !== "production";
const monorepoRoot = path.resolve(__dirname, "../..");

module.exports = {
  presets: ["next/babel"],
  plugins: [
    // Resolves StyleXN escape hatches (web({ }) / native({ })) before StyleX.
    ["stylexn/babel", { platform: "web" }],
    [
      "@stylexjs/babel-plugin",
      {
        dev,
        // Shared code imports StyleX as "stylexn" (its web entry re-exports StyleX).
        importSources: ["@stylexjs/stylex", "stylexn"],
        runtimeInjection: false,
        enableInlinedConditionalMerge: true,
        treeshakeCompensation: true,
        // rootDir must cover packages/* so theme files resolve and class
        // hashes stay stable for shared code.
        unstable_moduleResolution: { type: "commonJS", rootDir: monorepoRoot },
      },
    ],
  ],
};
