import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node22',
  clean: true,
  dts: false,
  sourcemap: true,
  bundle: true,
  splitting: false,
  // Preserve import.meta.url so the CLI can read ../package.json from dist/.
  shims: true,
  outExtension: () => ({ js: '.cjs' }),
  noExternal: ['@pr-nutrition/core', 'commander', 'picomatch']
});
