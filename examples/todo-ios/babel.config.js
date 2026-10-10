module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Compiles stylex.create() to StyleXN's runtime shape. Unsupported
      // styles fail the build when CI is set, otherwise warn and are stripped.
      ["stylexn/babel", { platform: "native" }],
    ],
  };
};
