import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

const SERVER_FILES = [
  "packages/botrepel/src/*.ts",
  "packages/botrepel/src/server/**/*.ts",
  "packages/botrepel/src/better-auth/**/*.ts",
  "packages/botrepel/src/cli/**/*.ts",
  "api/**/*.ts",
  "apps/web/lib/**/*.ts",
  "apps/web/scripts/**/*.ts",
  "apps/web/*.ts",
  "scripts/**/*.ts",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.cache/**",
      "**/dist/**",
      "**/.build/**",
      "**/public/**",
      "**/.data/**",
      ".scratch/**",
      ".agents/skills/**",
      "**/.claude/worktrees/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser, Bun: "readonly" },
    },
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='forEach']",
          message: "Use for...of for side effects, or map/filter/reduce for transformations.",
        },
      ],
      "@typescript-eslint/array-type": ["error", { default: "array" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true, caughtErrors: "none" },
      ],
      "import-x/no-duplicates": "error",
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        { allowExpressions: true, allowTypedFunctionExpressions: true, allowHigherOrderFunctions: true },
      ],
    },
  },
  {
    files: SERVER_FILES,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: false }],
    },
  },
  {
    files: ["apps/web/tests/**/*.ts", "packages/*/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
);
