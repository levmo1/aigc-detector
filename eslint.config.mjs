import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  globalIgnores([
    'node_modules/**',
    'dist/**',
    'dist-server/**',
    'dist-app/**',
    'release/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.superpowers/**',
    'src-tauri/target/**',
    'src-tauri/gen/**',
    '.firecrawl/**',
  ]),
  {
    files: ['**/*.{ts,tsx,mjs,cjs}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        AbortSignal: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-control-regex': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
])
