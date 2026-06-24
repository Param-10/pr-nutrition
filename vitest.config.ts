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
    include: ["packages/**/*.test.ts"],
  },
});
