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
  outExtension: () => ({ js: '.cjs' }),
  noExternal: ['@pr-nutrition/core', 'commander']
});
