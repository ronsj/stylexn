import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "stylexn",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
