import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import pluginPlaywright from 'eslint-plugin-playwright';
import pluginVue from 'eslint-plugin-vue';

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  ...pluginVue.configs['flat/strongly-recommended'],
  ...vueTsEslintConfig(),

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
  skipFormatting,

  {
    rules: {
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/multi-word-component-names': ['off'],
      'vue/valid-v-slot': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
