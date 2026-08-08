import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['node_modules/**', 'viewer/tailwind.css']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.nodeBuiltin
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    },
    rules: {
      curly: 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['viewer/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser
    },
    rules: {
      // The viewer is loaded as ordered classic scripts and intentionally shares globals.
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  }
]
