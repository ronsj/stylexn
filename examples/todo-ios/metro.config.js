const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Shared code imports StyleX by its own name; on native that is StyleXN.
// (`stylexn` itself resolves to the runtime via its `react-native` export
// condition, so only the `@stylexjs/stylex` name needs an alias.)
const { resolveRequest } = config.resolver;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = moduleName === "@stylexjs/stylex" ? "stylexn/native" : moduleName;
  return (resolveRequest ?? context.resolveRequest)(context, target, platform);
};

module.exports = config;
