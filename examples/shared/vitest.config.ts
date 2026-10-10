import { defineConfig } from "vitest/config";
import { stylexTestPlugin } from "../../vitest.shared.ts";

export default defineConfig({
  plugins: [stylexTestPlugin()],
  test: {
    name: "shared",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
