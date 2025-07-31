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

  const assertSuccessfulInit = async ({
    command,
    expectedYaml,
  }: {
    command: string;
    expectedYaml: string;
  }) => {
    const result = await runPatchy(command, ctx.patchesDir);

    expect(result.exitCode).toBe(0);

    const configPath = join(ctx.patchesDir, "patchy.yaml");
    expect(existsSync(configPath)).toBe(true);

    const yamlContent = readFileSync(configPath, "utf-8");
    expect(yamlContent.trim()).toBe(expectedYaml.trim());
  };

  const assertFailedInit = async ({
    command,
    expectedErrors,
  }: {
    command: string;
    expectedErrors: string | string[];
  }) => {
    const result = await runPatchy(command, ctx.patchesDir);

    expect(result.exitCode).toBe(1);

    const errors = Array.isArray(expectedErrors)
      ? expectedErrors
      : [expectedErrors];
    for (const error of errors) {
      expect(result.stderr).toContain(error);
    }
  };

  it("should initialize patchy with all flags", async () => {
    await assertSuccessfulInit({
      command: `init --repoUrl https://github.com/example/test-repo.git --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
      expectedYaml: dedent`
        repo_url: https://github.com/example/test-repo.git
        repo_dir: main
        repo_base_dir: ${ctx.repoBaseDir}
        patches_dir: patches
        ref: main
      `,
    });
  });

  describe("error cases", () => {
    it("should fail with malformed repo url - missing protocol", async () => {
      await assertFailedInit({
        command: `init --repoUrl github.com/example/repo --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "valid Git URL",
      });
    });

    it("should fail with malformed repo url - invalid domain", async () => {
      await assertFailedInit({
        command: `init --repoUrl https://invalid_domain/repo --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "valid Git URL",
      });
    });

    it("should fail with malformed repo url - incomplete path", async () => {
      await assertFailedInit({
        command: `init --repoUrl https://github.com/ --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "valid Git URL",
      });
    });

    it("should fail when config file exists without force flag", async () => {
      await runPatchy(
        `init --repoUrl https://github.com/example/repo.git --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
        ctx.patchesDir,
      );

      await assertFailedInit({
        command: `init --repoUrl https://github.com/example/another-repo.git --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml`,
        expectedErrors: [
          "Configuration file already exists",
          "Use --force to overwrite",
        ],
      });
    });

    it("should fail with validation error for empty repo_url", async () => {
      await assertFailedInit({
        command: `init --repoUrl "" --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "Repository URL is required",
      });
    });
  });
});
