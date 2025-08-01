import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertConfigFileExists,
  assertFailedCommand,
  assertSuccessfulCommand,
  cleanupTestDir,
  createTestDir,
  runPatchy,
  stabilizeTempDir,
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

  const assertSuccessfulInit = async (command: string) => {
    await assertSuccessfulCommand(command, ctx.patchesDir);

    const configPath = join(ctx.patchesDir, "patchy.yaml");
    assertConfigFileExists(configPath);

    const yamlContent = readFileSync(configPath, "utf-8");
    return yamlContent.trim();
  };

  const assertFailedInit = async ({
    command,
    expectedErrors,
  }: {
    command: string;
    expectedErrors: string | string[];
  }) => {
    await assertFailedCommand(command, ctx.patchesDir, expectedErrors);
  };

  it("should initialize patchy with all flags", async () => {
    const yamlContent = await assertSuccessfulInit(
      `init --repoUrl https://github.com/example/test-repo.git --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --ref main --config patchy.yaml --force`,
    );

    expect(stabilizeTempDir(yamlContent)).toMatchInlineSnapshot(`
      "repo_url: https://github.com/example/test-repo.git
      repo_dir: main
      repo_base_dir: <TEST_DIR>/repos
      patches_dir: patches
      ref: main"
    `);
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
