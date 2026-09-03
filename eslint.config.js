'use strict';

const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const js = require('@eslint/js');
const sortDeclarations = require('./lib/index.js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        console: 'readonly',
        exports: 'writable',
        module: 'writable',
        process: 'readonly',
        require: 'readonly'
      },
      sourceType: 'commonjs'
    },
    name: 'eslint-plugin-sort-declarations/eslint-config',
    plugins: {
      'sort-declarations': sortDeclarations
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          arrowParens: 'avoid',
          printWidth: 120,
          singleQuote: true,
          trailingComma: 'none'
        }
      ],
      'sort-declarations/sort-module-declarations': 'error',
      'sort-declarations/sort-variable-declarations': 'error'
    }
  },
  eslintPluginPrettierRecommended
];
