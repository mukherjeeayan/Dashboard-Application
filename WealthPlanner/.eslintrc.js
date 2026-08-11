module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    // The engine must never import a concrete Jurisdiction Pack file directly —
    // it only consumes the abstract JurisdictionPack type (docs/05 §5.3, docs/03 §3.3).
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@wealthpath/jurisdictions/packs",
            message:
              "Engine code must not import a concrete Jurisdiction Pack. Only the loader/server may import packs.",
          },
        ],
        patterns: [
          {
            group: ["@wealthpath/jurisdictions/packs/*"],
            message:
              "Engine code must not import a concrete Jurisdiction Pack. Only the loader/server may import packs.",
          },
        ],
      },
    ],
  },
  ignorePatterns: ["node_modules", "dist", "coverage", "test-results", "playwright-report", "e2e", "playwright.config.ts"],
  overrides: [
    {
      files: ["packages/client/**/*.{ts,tsx}"],
      env: { browser: true },
    },
  ],
};
