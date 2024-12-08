import antfu from '@antfu/eslint-config';

export default antfu(
  {
    ignores: ['samples'],
  },
  {
    // style
    rules: {
      'style/quote-props': ['warn', 'as-needed'],
      'style/semi': ['warn', 'always'],
      'style/max-statements-per-line': ['warn', { max: 1 }],
      curly: ['warn', 'all'],
      'style/member-delimiter-style': [
        'warn',
        {
          multiline: { delimiter: 'semi', requireLast: true },
          singleline: { delimiter: 'semi', requireLast: false },
          multilineDetection: 'brackets',
        },
      ],
      'unused-imports/no-unused-vars': ['error', { vars: 'all', args: 'none' }],
      'no-cond-assign': 'off',
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
