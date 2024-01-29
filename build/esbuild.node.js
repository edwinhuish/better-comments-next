const process = require('process');
const esbuild = require('esbuild');

const IS_PROD = process.env.NODE_ENV === 'production';

build();

async function build() {
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
      sourcemap: !IS_PROD,
      minify: IS_PROD,

    }),
    // esbuild.build({
    //   entryPoints: [
    //     './src/extension.ts',
    //   ],
    //   external: ['vscode'],
    //   bundle: true,
    //   outfile: './dist/extension.web.js',
    //   platform: 'browser',
    //   target: 'chrome108',
    //   sourcemap: false,
    //   minify: false,
    // }),
  ]);
}
