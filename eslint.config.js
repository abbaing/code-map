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
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Use a scoped package alias for repository modules.'
            }
          ]
        }
      ],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['viewer/*.js'],
    languageOptions: {
      globals: globals.browser
    }
  }
]
