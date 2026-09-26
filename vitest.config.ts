import { defineConfig } from "vitest/config";

// Each project has its own vitest.config.ts; this file just fans out so
// `pnpm test` at the root runs all of them in one process.
export default defineConfig({
  test: {
    projects: ["apps/example-web", "apps/example-mobile", "packages/*"],
  },
});
