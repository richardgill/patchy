import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { AIFriendlyReporter } from "./vitest-ai-reporter";

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },
  test: {
    reporters: [new AIFriendlyReporter()],
    env: {
      // Disable chalk colors in tests for consistent snapshots
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "e2e",
          include: ["src/e2e/**/*.test.ts"],
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
