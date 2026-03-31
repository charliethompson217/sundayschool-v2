import js from '@eslint/js';
import globals from 'globals';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import eslintReact from '@eslint-react/eslint-plugin';

export default [
  { ignores: ['dist/**', '*.config.js', 'sst.config.ts', 'sst-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintReact.configs['recommended-typescript'],
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Customize any rules from @eslint-react, e.g.,
    },
  },
];
