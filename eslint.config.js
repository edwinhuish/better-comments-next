const antfu = require('@antfu/eslint-config').default;

module.exports = antfu(
  {
    ignores: [
      'src/test',
    ],
  },
  {
    // style
    rules: {
      'style/quote-props': ['error', 'as-needed'],
      'style/semi': ['error', 'always'],
      'style/max-statements-per-line': ['error', { max: 1 }],
      curly: ['warn', 'all'],
      'style/member-delimiter-style': ['warn', {
        multiline: { delimiter: 'semi', requireLast: true },
        singleline: { delimiter: 'semi', requireLast: false },
        multilineDetection: 'brackets',
      }],

    },
  },
  {
    files: ['package.json'],
    rules: {
      'jsonc/indent': ['error', 4],
    },
  },
  {
    rules: {
      'unicorn/prefer-node-protocol': 'off',
    },
  },
);
