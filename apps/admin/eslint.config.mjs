// The tilawa-admin fork's own flat ESLint config. The fork inherited the lint
// scripts from the upstream fork but not its root config file; this is a fresh, minimal
// flat config — TypeScript recommended plus the usual JS recommended set — with
// the same intent as the upstream rule set: real problems, not style opinions.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The codebase relies on bare `any` where SQLite rows are untyped by design.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
