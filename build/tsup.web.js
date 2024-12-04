const { dependencies } = require('../package.json');

const { defineConfig } = require('tsup');

// function replaceNodeBuiltIns(replaces) {
//   const filter = RegExp(`^(${Object.keys(replaces).join('|')})$`);
//   return {
//     name: 'replaceNodeBuiltIns',
//     setup(build) {
//       build.onResolve({ filter }, arg => ({
//         path: replaces[arg.path],
//       }));
//     },
//   };
// }

export default defineConfig((options) => {
  // const replaces = {
  //   path: require.resolve('path-browserify'),
  // };

  return {
    entry: {
      'extension.web': 'src/extension.ts',
    },
    external: ['vscode'],
    noExternal: Object.keys(dependencies),
    bundle: true,
    outDir: 'dist',
    format: ['cjs'],
    platform: 'browser',
    target: ['chrome108'],
    minify: !options.watch,
    sourcemap: !!options.watch,
    replaceNodeEnv: true,
    inject: ['process/browser'],
    treeshake: true,
    // esbuildPlugins: [
    //   replaceNodeBuiltIns(replaces),
    // ],
  };
});
