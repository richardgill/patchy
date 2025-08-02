import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertConfigFileExists,
  assertFailedCommand,
  assertSuccessfulCommand,
  cleanupTmpDir,
  generateTmpDir,
  runPatchy,
  setupTestWithConfig,
  stableizeTempDir,
} from "./test-utils";

describe("patchy init", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  const assertSuccessfulInit = async (command: string) => {
    await assertSuccessfulCommand(command, tmpDir);

    const configPath = join(tmpDir, "patchy.yaml");
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
    await assertFailedCommand(command, tmpDir, expectedErrors);
  };

  it("should initialize patchy with all flags", async () => {
    setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
    });
    const yamlContent = await assertSuccessfulInit(
      `init --repo-url https://github.com/example/test-repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.yaml --force`,
    );

    expect(stableizeTempDir(yamlContent)).toMatchInlineSnapshot(`
      "repo_url: https://github.com/example/test-repo.git
      ref: main
      repo_base_dir: repoBaseDir1
      repo_dir: main
      patches_dir: patches"
    `);
  });

  describe("error cases", () => {
    it("should fail with malformed repo url - missing protocol", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });
      await assertFailedInit({
        command: `init --repo-url github.com/example/repo --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "valid Git URL",
      });
    });

    it("should fail with malformed repo url - invalid domain", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      await assertFailedInit({
        command: `init --repo-url https://invalid_domain/repo --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "valid Git URL",
      });
    });

    it("should fail with malformed repo url - incomplete path", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      await assertFailedInit({
        command: `init --repo-url https://github.com/ --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "valid Git URL",
      });
    });

    it("should fail when config file exists without force flag", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
        yamlConfig: { hello: "world" },
      });

      await runPatchy(
        `init --repo-url https://github.com/example/repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.yaml --force`,
        tmpDir,
      );

      await assertFailedInit({
        command: `init --repo-url https://github.com/example/another-repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.yaml`,
        expectedErrors: [
          "Configuration file already exists",
          "Use --force to overwrite",
        ],
      });
    });

    it("should fail with validation error for empty repo_url", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });
      await assertFailedInit({
        command: `init --repo-url "" --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.yaml --force`,
        expectedErrors: "Repository URL is required",
      });
    });
  });
});
