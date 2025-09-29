import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import tseslint from 'typescript-eslint';
import pluginPlaywright from 'eslint-plugin-playwright';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

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

  ...tseslint.configs.recommended,

  // Vue + TypeScript configuration
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
  },

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
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
    },
  },
];
