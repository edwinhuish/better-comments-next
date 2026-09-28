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
  {
    // Markdown fenced code blocks are extracted as virtual files by the
    // markdown processor and linted like real source (e.g. `AGENTS.md/1.ts`).
    // Examples/fragments are not standalone modules, so module-level and
    // fragment-hostile rules are relaxed here; real syntax errors are still
    // reported.
    files: ['**/*.md/*.{ts,tsx,js,jsx,mjs,cjs,vue}'],
    rules: {
      'unused-imports/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'ts/no-unused-vars': 'off',
    },
  },
);
