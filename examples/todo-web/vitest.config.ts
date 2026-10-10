import { defineConfig } from "vitest/config";
import { stylexTestPlugin } from "../../vitest.shared.ts";

export default defineConfig({
  plugins: [stylexTestPlugin()],
  // tsconfig.json says jsx: "preserve" for Next; Vite would honor that and
  // leave JSX uncompiled in tests, so force the automatic runtime here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    name: "todo-web",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    // Playwright specs live in e2e/ and must not be picked up here.
    include: ["app/**/*.test.{ts,tsx}"],
  },
});
