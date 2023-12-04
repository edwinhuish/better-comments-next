export default {
  '*.{js,jsx,ts,tsx,vue}': () => {
    return [
      'tsc -p . --noEmit',
      'eslint --cache --max-warnings 0 ',
    ];
  },
};
