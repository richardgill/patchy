import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  assertConfigFileExists,
  assertFailedCommand,
  assertSuccessfulCommand,
  generateTmpDir,
  runPatchy,
  setupTestWithConfig,
  stabilizeTempDir,
} from "./test-utils";

describe("patchy init", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  const assertSuccessfulInit = async (command: string) => {
    await assertSuccessfulCommand(command, tmpDir);

    const configPath = join(tmpDir, "patchy.json");
    assertConfigFileExists(configPath);

    const jsonContent = readFileSync(configPath, "utf-8");
    return jsonContent.trim();
  };

  const assertFailedInit = async (command: string) => {
    return await assertFailedCommand(command, tmpDir);
  };

  it("should initialize patchy with all flags", async () => {
    setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
    });
    const jsonContent = await assertSuccessfulInit(
      `init --repo-url https://github.com/example/test-repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
    );

    expect(stabilizeTempDir(jsonContent)).toMatchInlineSnapshot(`
      "{
        \"repo_url\": \"https://github.com/example/test-repo.git\",
        \"ref\": \"main\",
        \"repo_base_dir\": \"repoBaseDir1\",
        \"repo_dir\": \"main\",
        \"patches_dir\": \"patches\"
      }"
    `);
  });

  describe("error cases", () => {
    it("should fail with malformed repo url - missing protocol", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });
      const result = await assertFailedInit(
        `init --repo-url github.com/example/repo --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
      );

      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });

    it("should fail with malformed repo url - invalid domain", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      const result = await assertFailedInit(
        `init --repo-url https://invalid_domain/repo --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
      );
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });

    it("should fail with malformed repo url - incomplete path", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });

      const result = await assertFailedInit(
        `init --repo-url https://github.com/ --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
      );
      expect(result.stderr).toContain("valid Git URL");
    });

    it("should fail when config file exists without force flag", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
        jsonConfig: { hello: "world" },
      });

      await runPatchy(
        `init --repo-url https://github.com/example/repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      const result = await assertFailedInit(
        `init --repo-url https://github.com/example/another-repo.git --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json`,
      );
      expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(
        `
        "Configuration file already exists at <TEST_DIR>/patchy.json
        Use --force to overwrite"
      `,
      );
    });

    it("should fail with validation error for empty repo_url", async () => {
      setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repoBaseDir1", repoDir: "main" },
      });
      const result = await assertFailedInit(
        `init --repo-url "" --repo-dir main --repo-base-dir repoBaseDir1 --patches-dir patches --ref main --config patchy.json --force`,
      );
      expect(result.stderr).toMatchInlineSnapshot(
        `"Repository URL is required"`,
      );
    });
  });
});
