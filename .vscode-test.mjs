import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  mocha: {
    ui: 'bdd', // describe/it instead of the default tdd (suite/test)
  },
});
