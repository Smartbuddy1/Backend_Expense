const eslintPluginPrettier = require('eslint-plugin-prettier/recommended');

module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**']
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn'
    }
  },
  eslintPluginPrettier
];
