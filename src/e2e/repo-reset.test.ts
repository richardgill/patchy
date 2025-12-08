import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { assertDefined } from "~/lib/assert";
import { createTestGitClient } from "~/lib/git";
import {
  assertFailedCommand,
  assertSuccessfulCommand,
  generateTmpDir,
  setupTestWithConfig,
  stabilizeTempDir,
} from "./test-utils";

describe("patchy repo reset", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  const initGitRepo = async (repoPath: string) => {
    const git = createTestGitClient(repoPath);
    await git.init();
    await git.addConfig("user.email", "test@test.com");
    await git.addConfig("user.name", "Test User");
  };

  const createInitialCommit = async (
    repoPath: string,
    filename: string,
    content: string,
  ) => {
    const filePath = join(repoPath, filename);
    await writeFile(filePath, content);
    const git = createTestGitClient(repoPath);
    await git.add(filename);
    await git.commit("initial commit");
  };

  const modifyFile = async (
    repoPath: string,
    filename: string,
    content: string,
  ) => {
    const filePath = join(repoPath, filename);
    await writeFile(filePath, content);
  };

  it("should reset repository and discard local changes", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repos", repoDir: "test-repo" },
    });

    const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    await initGitRepo(repoPath);
    await createInitialCommit(repoPath, "test.txt", "original content");
    await modifyFile(repoPath, "test.txt", "modified content");

    const contentBefore = readFileSync(join(repoPath, "test.txt"), "utf-8");
    expect(contentBefore).toBe("modified content");

    await assertSuccessfulCommand(
      `patchy repo reset --repo-base-dir repos --repo-dir test-repo`,
      tmpDir,
    );

    const contentAfter = readFileSync(join(repoPath, "test.txt"), "utf-8");
    expect(contentAfter).toBe("original content");
  });

  it("should show success message after reset", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repos", repoDir: "test-repo" },
    });

    const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    await initGitRepo(repoPath);
    await createInitialCommit(repoPath, "test.txt", "content");

    const result = await assertSuccessfulCommand(
      `patchy repo reset --repo-base-dir repos --repo-dir test-repo`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(
      `"Successfully reset repository: <TEST_DIR>/repos/test-repo"`,
    );
  });

  describe("error cases", () => {
    it("should fail when repo directory does not exist", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
      });

      const result = await assertFailedCommand(
        `patchy repo reset --repo-base-dir repos --repo-dir nonexistent`,
        tmpDir,
      );

      expect(stabilizeTempDir(result.stderr)).toContain("does not exist");
    });

    it("should fail when directory is not a git repository", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos", repoDir: "not-a-repo" },
      });

      const result = await assertFailedCommand(
        `patchy repo reset --repo-base-dir repos --repo-dir not-a-repo`,
        tmpDir,
      );

      expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(
        `"Not a Git repository: <TEST_DIR>/repos/not-a-repo"`,
      );
    });

    it("should fail when repo-base-dir is missing", async () => {
      await setupTestWithConfig({ tmpDir });

      const result = await assertFailedCommand(
        `patchy repo reset --repo-dir test-repo`,
        tmpDir,
      );

      expect(result.stderr).toContain("Missing");
    });

    it("should fail when repo-dir is missing", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
      });

      const result = await assertFailedCommand(
        `patchy repo reset --repo-base-dir repos`,
        tmpDir,
      );

      expect(result.stderr).toContain("Missing");
    });
  });

  describe("dry-run", () => {
    it("should not reset when --dry-run is set", async () => {
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos", repoDir: "test-repo" },
      });

      const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
      await initGitRepo(repoPath);
      await createInitialCommit(repoPath, "test.txt", "original content");
      await modifyFile(repoPath, "test.txt", "modified content");

      const result = await assertSuccessfulCommand(
        `patchy repo reset --repo-base-dir repos --repo-dir test-repo --dry-run`,
        tmpDir,
      );

      expect(result.stdout).toContain("[DRY RUN]");
      expect(result.stdout).toContain("Would hard reset");

      const contentAfter = readFileSync(join(repoPath, "test.txt"), "utf-8");
      expect(contentAfter).toBe("modified content");
    });

    it("should still validate repo exists in dry-run mode", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
      });

      const result = await assertFailedCommand(
        `patchy repo reset --repo-base-dir repos --repo-dir nonexistent --dry-run`,
        tmpDir,
      );

      expect(stabilizeTempDir(result.stderr)).toContain("does not exist");
    });
  });
});
