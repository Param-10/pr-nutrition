import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/run.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  dts: false,
  sourcemap: true,
  bundle: true,
  noExternal: ['@pr-nutrition/core']
});
