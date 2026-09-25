import { defineConfig } from "vitest/config";
import { stylexTestPlugin } from "../../vitest.shared.ts";

export default defineConfig({
  plugins: [stylexTestPlugin()],
  test: {
    name: "shared",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
