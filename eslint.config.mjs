import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['out', 'dist', 'node_modules', 'specs', 'release'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      '*.ts',
      '*.mts',
      '*.mjs',
      'scripts/**/*.mjs',
      'tests/**/*.ts',
    ],
    languageOptions: { globals: globals.node },
  },
);
