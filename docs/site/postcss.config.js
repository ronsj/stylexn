const babelConfig = require("./babel.config");

module.exports = {
  plugins: {
    "@stylexjs/postcss-plugin": {
      // Globs are relative to docs/site. Shared source must be listed
      // explicitly; auto-discovery does not look outside this directory.
      // The elements' own rules are not compiled here: like any consumer,
      // the site imports them precompiled from stylexn/elements.css.
      include: ["app/**/*.{js,jsx,ts,tsx}", "../../examples/shared/src/**/*.{js,jsx,ts,tsx}"],
      babelConfig: {
        babelrc: false,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: babelConfig.plugins,
      },
      useCSSLayers: true,
    },
  },
};
