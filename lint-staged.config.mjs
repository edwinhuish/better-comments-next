export default {
  '*.{js,jsx,ts,tsx,vue}': () => {
    return [
      'tsc -p tsconfig.json --noEmit',
      'eslint --cache --max-warnings 0 ',
    ];
  },
};
