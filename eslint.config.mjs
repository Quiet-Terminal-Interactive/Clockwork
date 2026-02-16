import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const tsFiles = ['**/*.ts']

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'engine/**/src/*.js',
      'engine/**/src/*.d.ts',
      'apps/tauri-shell/src-tauri/**',
      'apps/tauri-shell/web/vite.config.ts',
      'vitest.config.ts',
      'apps/examples/**'
    ]
  },
  js.configs.recommended,
  {
    files: tsFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['engine/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'qti-clockwork-tauri-bridge',
            'qti-clockwork-gl',
            'qti-clockwork-materials',
            'qti-clockwork-passes',
            'qti-clockwork-shaders',
            '**/engine/platform/**',
            '**/engine/renderer-webgl2/**'
          ]
        }
      ]
    }
  },
  prettier
]

