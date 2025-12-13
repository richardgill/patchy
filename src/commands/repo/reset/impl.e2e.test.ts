import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { assertDefined } from "~/lib/assert";
import {
  commitFile,
  initGitRepo,
  initGitRepoWithCommit,
} from "~/testing/git-helpers";
import {
  generateTmpDir,
  runCli,
  runCliWithPrompts,
  setupTestWithConfig,
  writeFileIn,
} from "~/testing/test-utils";

describe("patchy repo reset", () => {
  it("should reset repository and discard local changes", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos", repoDir: "test-repo" },
    });

    const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "original content");
    await writeFileIn(repoPath, "test.txt", "modified content");

    expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");

    const result = await runCli(
      `patchy repo reset --clones-dir repos --repo-dir test-repo --yes`,
      tmpDir,
    );
    expect(result).toSucceed();

    expect(join(repoPath, "test.txt")).toHaveFileContent("original content");
  });

  it("should show success message after reset", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos", repoDir: "test-repo" },
    });

    const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "content");

    const result = await runCli(
      `patchy repo reset --clones-dir repos --repo-dir test-repo --yes`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(
      `"Successfully reset repository: <TEST_DIR>/repos/test-repo"`,
    );
  });

  describe("error cases", () => {
    it("should fail when repo directory does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --repo-dir nonexistent`,
        tmpDir,
      );

      expect(result).toFailWith("does not exist");
    });

    it("should fail when directory is not a git repository", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos", repoDir: "not-a-repo" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --repo-dir not-a-repo`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Not a Git repository: <TEST_DIR>/repos/not-a-repo"`,
      );
    });

    it("should fail when clones-dir directory does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({ tmpDir });

      const result = await runCli(
        `patchy repo reset --repo-dir test-repo`,
        tmpDir,
      );

      // Uses default ./clones/, which doesn't exist
      expect(result).toFailWith("does not exist");
    });

    it("should fail when repo-dir is missing", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos`,
        tmpDir,
      );

      expect(result).toFailWith("Missing");
    });
  });

  describe("dry-run", () => {
    it("should not reset when --dry-run is set", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos", repoDir: "test-repo" },
      });

      const repoPath = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
      await initGitRepo(repoPath);
      await commitFile(repoPath, "test.txt", "original content");
      await writeFileIn(repoPath, "test.txt", "modified content");

      const result = await runCli(
        `patchy repo reset --clones-dir repos --repo-dir test-repo --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("Would hard reset");

      expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");
    });

    it("should still validate repo exists in dry-run mode", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --repo-dir nonexistent --dry-run`,
        tmpDir,
      );

      expect(result).toFailWith("does not exist");
    });
  });

  describe("confirmation prompt", () => {
    it("should reset when user confirms", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          repoDir: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          repo_dir: "my-repo",
        },
      });

      const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
      await initGitRepoWithCommit(repoDir);

      // Make uncommitted changes
      await writeFileIn(repoDir, "dirty.txt", "uncommitted changes");

      const { resultPromise, tester } = runCliWithPrompts(
        "patchy repo reset",
        tmpDir,
      );

      // Confirm reset - move to "yes" and confirm
      tester.press("left");
      tester.press("return");

      const result = await resultPromise;
      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully reset");
    });

    it("should cancel when user declines", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          repoDir: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          repo_dir: "my-repo",
        },
      });

      const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
      await initGitRepoWithCommit(repoDir);

      const { resultPromise, tester } = runCliWithPrompts(
        "patchy repo reset",
        tmpDir,
      );

      // Decline reset - accept default (no)
      tester.press("return");

      const result = await resultPromise;
      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
    });

    it("should cancel when user presses escape", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          repoDir: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          repo_dir: "my-repo",
        },
      });

      const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
      await initGitRepoWithCommit(repoDir);

      const { resultPromise, tester } = runCliWithPrompts(
        "patchy repo reset",
        tmpDir,
      );

      // Press escape to cancel
      tester.press("escape");

      const result = await resultPromise;
      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
    });
  });
});
