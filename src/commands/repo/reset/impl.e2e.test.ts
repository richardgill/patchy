import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { assertDefined } from "~/lib/assert";
import { createGitClient } from "~/lib/git";
import { cancel, runCli, runCliWithPrompts } from "~/testing/e2e-utils";
import {
  generateTmpDir,
  setupTestWithConfig,
  writeFileIn,
} from "~/testing/fs-test-utils";
import {
  commitFile,
  initGitRepo,
  initGitRepoWithCommit,
} from "~/testing/git-helpers";

describe("patchy repo reset", () => {
  it("should reset repository and discard local changes", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
    });

    const repoPath = assertDefined(
      ctx.absoluteTargetRepo,
      "absoluteTargetRepo",
    );
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "original content");

    const git = createGitClient(repoPath);
    const baseCommit = (await git.revparse(["HEAD"])).trim();

    await writeFileIn(repoPath, "test.txt", "modified content");

    expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");

    const result = await runCli(
      `patchy repo reset --clones-dir repos --target-repo test-repo --base-revision ${baseCommit} --yes`,
      tmpDir,
    );
    expect(result).toSucceed();

    expect(join(repoPath, "test.txt")).toHaveFileContent("original content");
  });

  it("should show success message after reset", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
    });

    const repoPath = assertDefined(
      ctx.absoluteTargetRepo,
      "absoluteTargetRepo",
    );
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "content");

    const git = createGitClient(repoPath);
    const baseCommit = (await git.revparse(["HEAD"])).trim();

    const result = await runCli(
      `patchy repo reset --clones-dir repos --target-repo test-repo --base-revision ${baseCommit} --yes`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toContain("Successfully reset repository to");
    expect(result.stdout).toContain(baseCommit);
  });

  it("should reset to base_revision and remove patch commits", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
    });

    const repoPath = assertDefined(
      ctx.absoluteTargetRepo,
      "absoluteTargetRepo",
    );
    await initGitRepo(repoPath);
    await commitFile(repoPath, "base.txt", "base content");

    const git = createGitClient(repoPath);
    const baseCommit = (await git.revparse(["HEAD"])).trim();

    // Add patch commits
    await commitFile(repoPath, "patch1.txt", "patch 1");
    await commitFile(repoPath, "patch2.txt", "patch 2");

    // Verify we have 3 commits
    const logBefore = await git.log();
    expect(logBefore.total).toBe(3);

    const result = await runCli(
      `patchy repo reset --clones-dir repos --target-repo test-repo --base-revision ${baseCommit} --yes`,
      tmpDir,
    );
    expect(result).toSucceed();

    // Verify we're back to base commit
    const currentCommit = (await git.revparse(["HEAD"])).trim();
    expect(currentCommit).toBe(baseCommit);

    const logAfter = await git.log();
    expect(logAfter.total).toBe(1);

    // Verify patch files are gone
    expect(join(repoPath, "base.txt")).toExist();
    expect(join(repoPath, "patch1.txt")).not.toExist();
    expect(join(repoPath, "patch2.txt")).not.toExist();
  });

  describe("error cases", () => {
    it("should fail when repo directory does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo nonexistent --base-revision main`,
        tmpDir,
      );

      expect(result).toFailWith("does not exist");
    });

    it("should fail when directory is not a git repository", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos", targetRepo: "not-a-repo" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo not-a-repo --base-revision main`,
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
        `patchy repo reset --target-repo test-repo --base-revision main`,
        tmpDir,
      );

      // Uses default ./clones/, which doesn't exist
      expect(result).toFailWith("does not exist");
    });

    it("should fail when target-repo is missing", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --base-revision main`,
        tmpDir,
      );

      expect(result).toFailWith("Missing");
    });

    it("should fail when base-revision does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
      });

      const repoPath = join(tmpDir, "repos", "test-repo");
      await initGitRepoWithCommit(repoPath);

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo test-repo --base-revision nonexistent-sha --yes`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toContain("Failed to reset to base_revision");
      expect(result.stderr).toContain("nonexistent-sha");
    });
  });

  describe("dry-run", () => {
    it("should not reset when --dry-run is set", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
      });

      const repoPath = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepo(repoPath);
      await commitFile(repoPath, "test.txt", "original content");

      const git = createGitClient(repoPath);
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      await writeFileIn(repoPath, "test.txt", "modified content");

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo test-repo --base-revision ${baseCommit} --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("Would hard reset repository to");
      expect(result).toHaveOutput(baseCommit);

      expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");
    });

    it("should still validate repo exists in dry-run mode", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo nonexistent --base-revision main --dry-run`,
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
          targetRepo: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "my-repo",
        },
      });

      const repoDir = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepoWithCommit(repoDir);

      const git = createGitClient(repoDir);
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      // Make uncommitted changes
      await writeFileIn(repoDir, "dirty.txt", "uncommitted changes");

      const { result, prompts } = await runCliWithPrompts(
        `patchy repo reset --base-revision ${baseCommit}`,
        tmpDir,
      )
        .on({
          confirm: /discarding all commits and uncommitted changes/,
          respond: true,
        })
        .run();

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully reset");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(
            /discarding all commits and uncommitted changes/,
          ),
          response: true,
        },
      ]);
    });

    it("should cancel when user declines", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "my-repo",
        },
      });

      const repoDir = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepoWithCommit(repoDir);

      const git = createGitClient(repoDir);
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      const { result, prompts } = await runCliWithPrompts(
        `patchy repo reset --base-revision ${baseCommit}`,
        tmpDir,
      )
        .on({
          confirm: /discarding all commits and uncommitted changes/,
          respond: false,
        })
        .run();

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(
            /discarding all commits and uncommitted changes/,
          ),
          response: false,
        },
      ]);
    });

    it("should cancel when user cancels prompt", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "my-repo",
        },
      });

      const repoDir = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepoWithCommit(repoDir);

      const git = createGitClient(repoDir);
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      const { result, prompts } = await runCliWithPrompts(
        `patchy repo reset --base-revision ${baseCommit}`,
        tmpDir,
      )
        .on({
          confirm: /discarding all commits and uncommitted changes/,
          respond: cancel,
        })
        .run();

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(
            /discarding all commits and uncommitted changes/,
          ),
          response: "cancelled",
        },
      ]);
    });
  });
});
