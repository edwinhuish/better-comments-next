import * as esbuild from 'esbuild';

await Promise.all([
  esbuild.build({
    entryPoints: [
      './src/extension.ts',
    ],
    external: ['vscode'],
    bundle: true,
    outfile: './dist/extension.js',
    platform: 'node',
    target: 'node16',
    sourcemap: false,
    minify: true,

  }),
  esbuild.build({
    entryPoints: [
      './src/extension.ts',
    ],
    external: ['vscode'],
    bundle: true,
    outfile: './dist/extension.browser.js',
    platform: 'browser',
    target: 'chrome108',
    sourcemap: false,
    minify: true,
  }),
]);
