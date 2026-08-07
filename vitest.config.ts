import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@pr-nutrition/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      reportsDirectory: "coverage",
    },
    include: ["packages/**/*.test.ts", "scripts/**/*.test.ts"],
    // Most tests build real Git repositories in a temporary directory, so they
    // spawn many Git subprocesses. The 5s default is not enough headroom on a
    // loaded machine and made the doctor tests fail intermittently.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
