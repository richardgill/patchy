import { beforeEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  stabilizeTempDir,
} from "~/testing/test-utils";
import { getSchemaUrl } from "~/version";

describe("patchy init", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  it("should initialize patchy with all flags", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
    });

    const result = await runCli(
      `patchy init --repo-url https://github.com/example/test-repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
      tmpDir,
    );

    expect(result).toSucceed();
    const configPath = join(tmpDir, "patchy.json");
    expect(existsSync(configPath)).toBe(true);
    const jsonContent = readFileSync(configPath, "utf-8").trim();

    const config = JSON.parse(jsonContent);
    expect(config).toEqual({
      $schema: await getSchemaUrl(),
      repo_url: "https://github.com/example/test-repo.git",
      ref: "main",
      repo_base_dir: "repoBaseDir1",
      repo_dir: "main",
      patches_dir: "patches",
    });
  });

  describe("error cases", () => {
    it("should fail with malformed repo url - missing protocol", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      const result = await runCli(
        `patchy init --repo-url github.com/example/repo --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });

    it("should fail with malformed repo url - invalid domain", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      const result = await runCli(
        `patchy init --repo-url https://invalid_domain/repo --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });

    it("should fail with malformed repo url - incomplete path", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      const result = await runCli(
        `patchy init --repo-url https://github.com/ --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toContain("valid Git URL");
    });

    it("should fail when config file exists without force flag", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
        jsonConfig: { hello: "world" },
      });

      await runCli(
        `patchy init --repo-url https://github.com/example/repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      const result = await runCli(
        `patchy init --repo-url https://github.com/example/another-repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json`,
        tmpDir,
      );

      expect(result).toFail();
      expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(
        `
        "Configuration file already exists at <TEST_DIR>/patchy.json
        Use --force to overwrite"
      `,
      );
    });

    it("should fail with validation error for empty repo_url", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      const result = await runCli(
        `patchy init --repo-url "" --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });
  });
});
