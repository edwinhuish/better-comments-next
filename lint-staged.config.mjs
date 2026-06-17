const eslint = 'eslint --cache --max-warnings 0';
const tsc = 'tsc -p . --noEmit';

export default {
  '*.{js,jsx,ts,tsx,vue}': [tsc, eslint],
  '*.{css,less,scss,sass}': [eslint],
  '*.{md,markdown}': [eslint],
  '*.{json,json5}': [eslint],
  '*.{yml,yaml}': [eslint],
};
