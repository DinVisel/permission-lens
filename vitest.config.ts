import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "tools/*/test/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // packages/onchain's tests talk to a real anvil node over RPC — several
    // round trips per test easily exceed vitest's 5s default.
    testTimeout: 20_000,
  },
});
