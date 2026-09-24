// @ts-check
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

/** Network/Node built-ins that packages/core must never import — it has to run
 * offline in a browser, a wallet extension or a Snap. */
const bannedInCore = [
  "fs", "node:fs", "http", "node:http", "https", "node:https",
  "net", "node:net", "dns", "node:dns", "child_process", "node:child_process",
];

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**", "**/coverage/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...bannedInCore.map((name) => ({
              name,
              message: "packages/core must stay offline and dependency-free of Node/network APIs.",
            })),
            {
              name: "viem",
              importNames: ["createPublicClient", "http", "webSocket"],
              message: "Transport/client construction belongs in @permissionlens/onchain, not core.",
            },
          ],
          patterns: [
            {
              group: ["node:*"],
              message: "packages/core must stay offline and dependency-free of Node built-ins.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "packages/core must not perform network requests." },
      ],
    },
  },
];
