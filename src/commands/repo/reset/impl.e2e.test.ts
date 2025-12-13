import { beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertDefined } from "~/lib/assert";
import { commitFile, initGitRepo } from "~/testing/git-helpers";
import {
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  writeFileIn,
} from "~/testing/test-utils";

describe("patchy repo reset", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  it("should reset repository and discard local changes", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repos", repoDir: "test-repo" },
    });

    const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "original content");
    await writeFileIn(repoPath, "test.txt", "modified content");

    expect(readFileSync(join(repoPath, "test.txt"), "utf-8")).toBe(
      "modified content",
    );

    const result = await runCli(
      `patchy repo reset --repo-base-dir repos --repo-dir test-repo --yes`,
      tmpDir,
    );
    expect(result).toSucceed();

    expect(readFileSync(join(repoPath, "test.txt"), "utf-8")).toBe(
      "original content",
    );
  });

  it("should show success message after reset", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repos", repoDir: "test-repo" },
    });

    const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "content");

    const result = await runCli(
      `patchy repo reset --repo-base-dir repos --repo-dir test-repo --yes`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(
      `"Successfully reset repository: <TEST_DIR>/repos/test-repo"`,
    );
  });

  describe("error cases", () => {
    it("should fail when repo directory does not exist", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --repo-base-dir repos --repo-dir nonexistent`,
        tmpDir,
      );

      expect(result).toFailWith("does not exist");
    });

    it("should fail when directory is not a git repository", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos", repoDir: "not-a-repo" },
      });

      const result = await runCli(
        `patchy repo reset --repo-base-dir repos --repo-dir not-a-repo`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Not a Git repository: <TEST_DIR>/repos/not-a-repo"`,
      );
    });

    it("should fail when repo-base-dir is missing", async () => {
      await setupTestWithConfig({ tmpDir });

      const result = await runCli(
        `patchy repo reset --repo-dir test-repo`,
        tmpDir,
      );

      expect(result).toFailWith("Missing");
    });

    it("should fail when repo-dir is missing", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --repo-base-dir repos`,
        tmpDir,
      );

      expect(result).toFailWith("Missing");
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
      await commitFile(repoPath, "test.txt", "original content");
      await writeFileIn(repoPath, "test.txt", "modified content");

      const result = await runCli(
        `patchy repo reset --repo-base-dir repos --repo-dir test-repo --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("Would hard reset");

      expect(readFileSync(join(repoPath, "test.txt"), "utf-8")).toBe(
        "modified content",
      );
    });

    it("should still validate repo exists in dry-run mode", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --repo-base-dir repos --repo-dir nonexistent --dry-run`,
        tmpDir,
      );

      expect(result).toFailWith("does not exist");
    });
  });
});
