const js = require("@eslint/js");
const n = require("eslint-plugin-n");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["node_modules/**", "coverage/**"] },
  js.configs.recommended,
  n.configs["flat/recommended-script"],
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs"
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "n/no-missing-require": "error",
      "n/no-process-exit": "off",
      "no-console": "off"
    }
  },
  {
    // Dev-only tooling config + tests may require devDependencies.
    files: ["*.config.js", "tests/**/*.{js,mjs}", "**/*.test.{js,mjs}"],
    rules: { "n/no-unpublished-require": "off", "n/no-unpublished-import": "off" }
  },
  {
    files: ["tests/**/*.{js,mjs}", "**/*.test.{js,mjs}"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly"
      }
    }
  }
];
