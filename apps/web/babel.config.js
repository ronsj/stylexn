const path = require("node:path");

const dev = process.env.NODE_ENV !== "production";
const monorepoRoot = path.resolve(__dirname, "../..");

module.exports = {
  presets: ["next/babel"],
  plugins: [
    [
      "@stylexjs/babel-plugin",
      {
        dev,
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
