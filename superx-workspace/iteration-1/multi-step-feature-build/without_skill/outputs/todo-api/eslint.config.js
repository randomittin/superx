const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["error", "warn"] }],
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    ignores: ["node_modules/", "*.db"],
  },
];
