import { defineConfig } from 'tsup';

export default defineConfig((options) => {
  return {
    entry: ['src/extension.ts'],
    external: ['vscode'],
    bundle: true,
    outDir: 'dist',
    format: ['cjs'],
    platform: 'node',
    target: 'es2017',
    minify: !options.watch,
    sourcemap: !!options.watch,
    replaceNodeEnv: true,
  };
});
