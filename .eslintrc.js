'use strict';

module.exports = {
  plugins: ['jest', 'prettier'],
  extends: [
    'formidable/configurations/es6-node',
    'plugin:prettier/recommended',
    'plugin:jest/recommended'
  ],
  env: {
    'jest/globals': true
  },
  rules: {
    'func-style': 'off',
    'no-magic-numbers': 'off',
    'valid-jsdoc': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }]
  }
};
