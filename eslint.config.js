import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'coverage/', 'dist/', '.discovery/', 'tests/fixtures/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
);
