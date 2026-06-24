import { defineConfig } from "tsup";

export default defineConfig({
  bundle: true,
  clean: true,
  dts: false,
  entry: ["src/index.ts"],
  format: ["cjs"],
  noExternal: ["@actions/core", "@pr-nutrition/core"],
  outExtension: () => ({ js: ".cjs" }),
  platform: "node",
  sourcemap: false,
  splitting: false,
  target: "node24",
});
