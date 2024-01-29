/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

// @ts-check
'use strict';

const path = require('path');
const process = require('process');
const webpack = require('webpack');

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * @type {import('webpack').Configuration}
 */
const extensionConfig = {
  context: path.dirname(__dirname),
  mode: IS_PROD ? 'production' : 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: 'webworker', // extensions run in a webworker context
  entry: {
    'extension.web': './src/extension.ts',
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '../dist'),
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../[resource-path]',
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
    extensions: ['.ts', '.js'], // support ts-files and js-files
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      assert: require.resolve('assert'),
      path: require.resolve('path-browserify'),
      util: require.resolve('util/'),
    },
  },
  module: {
    rules: [{
      test: /\.ts$/,
      exclude: /node_modules/,
      use: [
        {
          loader: 'ts-loader',
        },
      ],
    }],
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1, // disable chunks by default since web extensions must be a single bundle
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser', // provide a shim for the global `process` variable
    }),
  ],
  externals: {
    vscode: 'commonjs vscode', // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },

  devtool: !IS_PROD ? 'nosources-source-map' : undefined,
  infrastructureLogging: {
    level: 'log', // enables logging required for problem matchers
  },

};

module.exports = extensionConfig;
