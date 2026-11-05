import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/api/src/generated/**',
      'apps/web/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
  // Web: reglas de Next.js, React y accesibilidad (jsx-a11y) solo para apps/web.
  ...nextVitals.map((config) => ({
    ...config,
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { ...config.settings, next: { rootDir: 'apps/web' } },
  })),
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
);
