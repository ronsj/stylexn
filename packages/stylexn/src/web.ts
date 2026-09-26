// On web `stylexn` is StyleX itself: the real compiler handles it (configure
// `importSources: ["stylexn"]` in @stylexjs/babel-plugin). Native resolves
// the `react-native` export condition to the StyleXN runtime instead.
export * from "@stylexjs/stylex";
