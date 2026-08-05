import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// Flat config, required by ESLint 9 + eslint-config-next 16 (both dropped
// .eslintrc support). Rules below are carried over verbatim from the old
// .eslintrc.json so lint behaviour is unchanged.
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
