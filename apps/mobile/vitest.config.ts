import path from "node:path";
import { defineConfig } from "vitest/config";
import { stylexnNativeTestPlugin } from "../../vitest.shared.ts";

// Unit tests for the mobile app: jsdom, with `react-native` replaced by
// StyleXN's testing mock (host elements that expose their style) and
// `stylexn`/`stylexn/elements` resolved through the `react-native` export
// condition, the way Metro resolves them.
export default defineConfig({
  plugins: [stylexnNativeTestPlugin()],
  resolve: {
    conditions: ["react-native"],
    alias: {
      "react-native": "stylexn/testing/react-native",
      "expo-status-bar": path.resolve(import.meta.dirname, "test/expo-status-bar.ts"),
    },
  },
  test: {
    name: "mobile",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "e2e"],
  },
});
