import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['test/integration/extension.test.ts'],
  external: ['vscode'],
  bundle: true,
  outDir: 'out/test',
  format: ['cjs'],
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
});
