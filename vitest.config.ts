import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "e2e",
          include: ["e2e/**/*.test.ts"],
          testTimeout: 30000,
          fileParallelism: true, // E2E tests should run sequentially to avoid conflicts
          pool: "forks", // Use forks for better isolation between e2e tests
          poolOptions: {
            forks: {
              singleFork: true, // Run all tests in a single fork to avoid overhead
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
