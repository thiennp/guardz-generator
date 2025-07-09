import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: nodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': 'off', // Allow console.log for CLI tool
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js'],
  },
]; 