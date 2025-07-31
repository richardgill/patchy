import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import dedent from "dedent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupTestDir,
  createTestDir,
  runPatchy,
  type TestContext,
} from "./test-utils";

describe("patchy init", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(ctx);
  });

  const successTestCases = [
    {
      name: "should initialize patchy with all flags",
      command: (ctx: TestContext) =>
        `init --repoUrl https://github.com/example/test-repo.git --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
      expectedYaml: (ctx: TestContext) => dedent`
        repo_url: https://github.com/example/test-repo.git
        repo_dir: main
        repo_base_dir: ${ctx.repoBaseDir}
        patches_dir: patches
        ref: main
      `,
    },
  ];

  for (const testCase of successTestCases) {
    it(testCase.name, async () => {
      const result = await runPatchy(testCase.command(ctx), ctx.patchesDir);

      expect(result.exitCode).toBe(0);

      const configPath = join(ctx.patchesDir, "patchy.yaml");
      expect(existsSync(configPath)).toBe(true);

      const yamlContent = readFileSync(configPath, "utf-8");
      expect(yamlContent.trim()).toBe(testCase.expectedYaml(ctx).trim());
    });
  }

  describe("error cases", () => {
    const errorTestCases = [
      {
        name: "should fail with malformed repo url - missing protocol",
        command: () => `init --repoUrl github.com/example/repo --force`,
        expectedError: "valid Git URL",
      },
      {
        name: "should fail with malformed repo url - invalid domain",
        command: () => `init --repoUrl https://invalid_domain/repo --force`,
        expectedError: "valid Git URL",
      },
      {
        name: "should fail with malformed repo url - incomplete path",
        command: () => `init --repoUrl https://github.com/ --force`,
        expectedError: "valid Git URL",
      },
      {
        name: "should fail when config file exists without force flag",
        setup: async (ctx: TestContext) => {
          await runPatchy(
            `init --repoUrl https://github.com/example/repo.git --force`,
            ctx.patchesDir,
          );
        },
        command: () =>
          `init --repoUrl https://github.com/example/another-repo.git`,
        expectedErrors: [
          "Configuration file already exists",
          "Use --force to overwrite",
        ],
      },
      {
        name: "should fail with validation error for empty repo_url",
        command: () => `init --repoUrl "" --force`,
        expectedError: "Repository URL is required",
      },
    ];

    for (const testCase of errorTestCases) {
      it(testCase.name, async () => {
        if (testCase.setup) {
          await testCase.setup(ctx);
        }

        const result = await runPatchy(testCase.command(), ctx.patchesDir);

        expect(result.exitCode).toBe(1);

        if (testCase.expectedError) {
          expect(result.stderr).toContain(testCase.expectedError);
        }

        if (testCase.expectedErrors) {
          for (const error of testCase.expectedErrors) {
            expect(result.stderr).toContain(error);
          }
        }
      });
    }
  });
});
