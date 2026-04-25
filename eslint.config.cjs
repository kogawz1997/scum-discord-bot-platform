const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'dist/**',
      '**/dist/**',
      'data/**',
      'artifacts/**',
      'output/**',
      'tmp/**',
      'tmp-*/**',
      'temp_*/**',
      '_compare/**',
      '.claude/**',
      'vendor/**',
      'backups/**',
      'owen scum/**',
      'น/**',
      'apps/web-portal-standalone/public/**',
      'src/admin/dashboard.html',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-control-regex': 'off',
      'no-empty': 'off',
      'no-extra-boolean-cast': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['apps/owner-ui-prototype/**/*.js'],
    ignores: [
      'apps/owner-ui-prototype/node_modules/**',
      'apps/owner-ui-prototype/dist/**',
      'apps/owner-ui-prototype/output/**',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
