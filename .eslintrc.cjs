// .eslintrc.js
process.env.ESLINT_TSCONFIG = 'tsconfig.json';

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  plugins: ['jsdoc'],
  extends: '@antfu',
  parser: '@typescript-eslint/parser',
  rules: {
    'quote-props': ['error', 'as-needed'],
    semi: 'off',
    '@typescript-eslint/semi': ['warn', 'always'],
    curly: ['error', 'all'],
    'brace-style': 'off',
    '@typescript-eslint/brace-style': ['error', '1tbs'],
    '@typescript-eslint/member-delimiter-style': ['warn', {
      multiline: { delimiter: 'semi', requireLast: true },
      singleline: { delimiter: 'semi', requireLast: false },
      multilineDetection: 'brackets',
    }],
    'import/order': ['warn', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      pathGroups: [
        {
          pattern: '@/**',
          group: 'internal',
        },
      ],
      pathGroupsExcludedImportTypes: ['type'],
    }],

    'unicorn/prefer-node-protocol': 'off',

    'comma-dangle': ['error', {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'only-multiline',
    }],
    'space-before-function-paren': ['error', {
      named: 'never',
      anonymous: 'always',
      asyncArrow: 'always',
    }],

    'no-cond-assign': 'off',

    eqeqeq: 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off', // setup()
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',

    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-vars': 'off',
    // 'unused-imports/no-unused-imports': 'off',
    '@typescript-eslint/no-explicit-any': 'off', // any
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/unbound-method': 'off',

    // JSDOC
    'jsdoc/check-alignment': 1, // Recommended
    'jsdoc/check-line-alignment': 1,
    'jsdoc/sort-tags': 1,
    'jsdoc/tag-lines': 1, // Recommended
    'jsdoc/valid-types': 1, // Recommended
  },
};
