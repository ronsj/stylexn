const babelConfig = require("./babel.config");

module.exports = {
  plugins: {
    "@stylexjs/postcss-plugin": {
      // Globs are relative to apps/example-web. Shared source must be listed
      // explicitly; auto-discovery does not look outside this directory.
      include: [
        "app/**/*.{js,jsx,ts,tsx}",
        "../../packages/shared/src/**/*.{js,jsx,ts,tsx}",
        "../../packages/stylexn/src/**/*.{js,jsx,ts,tsx}",
      ],
      babelConfig: {
        babelrc: false,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: babelConfig.plugins,
      },
      useCSSLayers: true,
    },
  },
};
