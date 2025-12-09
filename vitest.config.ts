import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { AIFriendlyReporter } from "./vitest-ai-reporter";

const resolveConfig = {
  alias: {
    "~": resolve(__dirname, "src"),
  },
};

export default defineConfig({
  resolve: resolveConfig,
  test: {
    reporters: [new AIFriendlyReporter()],
    env: {
      // Disable chalk colors in tests for consistent snapshots
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
    projects: [
      {
        // this is needed on each project to work
        resolve: resolveConfig,
        test: {
          name: "unit",
          include: ["src/test/**/*.test.ts"],
        },
      },
      {
        resolve: resolveConfig,
        test: {
          name: "e2e",
          include: ["src/e2e/**/*.test.ts"],
          setupFiles: ["src/e2e/matchers.ts"],
          testTimeout: 30000,
          fileParallelism: true,
          pool: "forks",
          poolOptions: {
            forks: {
              singleFork: false,
              maxForks: 10,
            },
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json"],
    },
  },
});
